import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import BountyHandler, { BountyImage } from '../../modules/BountyHandler';
import { Bounty } from '../../entity/Bounty';

export default class CreateBounty extends BotInteraction {
    get name() {
        return 'createbounty';
    }

    get description() {
        return 'Create a new bounty and post it to the bounty channel';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('item').setDescription('The item the bounty is for (e.g. Tumeken\'s Light)').setMaxLength(100).setRequired(true))
            .addStringOption((option) => option.setName('reward').setDescription('The reward for completing the bounty (e.g. 100M GP)').setMaxLength(100).setRequired(true))
            .addStringOption((option) => option.setName('description').setDescription('Small text under the title (defaults to the Trophy Hunting Bounty text)').setMaxLength(500).setRequired(false))
            .addAttachmentOption((option) => option.setName('image').setDescription('Image shown on the right of the bounty card').setRequired(false))
            .addStringOption((option) => option.setName('image-url').setDescription('Image URL to use instead of uploading one (e.g. RuneScape Wiki image link)').setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channelId = this.client.channelIds.bounties;
        if (!channelId) {
            return await interaction.editReply({ content: 'No bounty channel is configured for this server.' });
        }

        const imageAttachment = interaction.options.getAttachment('image');
        const imageUrl = interaction.options.getString('image-url')?.trim() || null;

        let image: BountyImage | null = null;
        if (imageAttachment) {
            if (!imageAttachment.contentType?.startsWith('image/')) {
                return await interaction.editReply({ content: 'The uploaded file must be an image.' });
            }
            image = { url: imageAttachment.url, name: imageAttachment.name };
        } else if (imageUrl) {
            if (!/^https?:\/\//i.test(imageUrl) || !this.client.util.checkURL(imageUrl)) {
                return await interaction.editReply({ content: 'The image URL must be a valid http(s) link.' });
            }
            image = { url: imageUrl };
        }

        const bounty = this.client.dataSource.getRepository(Bounty).create({
            item: interaction.options.getString('item', true).trim(),
            reward: interaction.options.getString('reward', true).trim(),
            description: interaction.options.getString('description')?.trim() || null,
            channelId,
            createdBy: interaction.user.id,
            status: 'open'
        });

        const channel = await BountyHandler.postBounty(this.client, bounty, image);

        return await interaction.editReply({ content: `Bounty **#${bounty.id}** for **${bounty.item}** posted in <#${channel.id}>.` });
    }
}
