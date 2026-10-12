import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import BotInteraction from '../../types/BotInteraction';
import BountyHandler from '../../modules/BountyHandler';
import { Bounty } from '../../entity/Bounty';

export default class CompleteBounty extends BotInteraction {
    get name() {
        return 'completebounty';
    }

    get description() {
        return 'Mark a bounty as completed and update its card with the winner and screenshot';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('bountymessageid').setDescription('Message ID (or link) of the bounty card').setRequired(true))
            .addUserOption((option) => option.setName('winner').setDescription('The member who completed the bounty').setRequired(true))
            .addAttachmentOption((option) => option.setName('screenshot').setDescription('Screenshot proving the bounty was completed').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // Accept either a raw message ID or a full message link (the ID is the last snowflake in the link).
        const messageInput = interaction.options.getString('bountymessageid', true).trim();
        const messageId = messageInput.match(/(\d{17,20})\/?$/)?.[1];
        if (!messageId) {
            return await interaction.editReply({ content: 'That doesn\'t look like a valid message ID or link.' });
        }

        const winner = interaction.options.getUser('winner', true);
        const screenshot = interaction.options.getAttachment('screenshot', true);

        if (!screenshot.contentType?.startsWith('image/')) {
            return await interaction.editReply({ content: 'The screenshot must be an image.' });
        }

        const bounty = await this.client.dataSource.getRepository(Bounty).findOne({ where: { messageId } });
        if (!bounty) {
            return await interaction.editReply({ content: `No bounty was found for message \`${messageId}\`.` });
        }

        if (bounty.status !== 'open') {
            return await interaction.editReply({ content: `The **${bounty.item}** bounty is already ${bounty.status}.` });
        }

        const message = await BountyHandler.completeBounty(this.client, bounty, winner.id, interaction.user.id, { url: screenshot.url, name: screenshot.name });

        return await interaction.editReply({ content: `Bounty **#${bounty.id}** for **${bounty.item}** completed by <@${winner.id}>: ${message.url}` });
    }
}
