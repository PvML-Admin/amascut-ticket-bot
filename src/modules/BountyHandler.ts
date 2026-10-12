import { AttachmentBuilder, Colors, ComponentType, ContainerBuilder, Message, MessageFlags, SeparatorSpacingSize, TextChannel, TextDisplayBuilder } from 'discord.js';
import axios from 'axios';
import Bot from '../Bot';
import { Bounty } from '../entity/Bounty';

export const BOUNTY_ACCENT_COLOUR = Colors.Orange;
export const BOUNTY_COMPLETED_ACCENT_COLOUR = 0x00FF00;
export const DEFAULT_BOUNTY_DESCRIPTION = 'Part of the Trophy Hunting Bounty. Manually complete when screenshot with keyword is posted.';

export interface BountyImage {
    url: string;
    name?: string;
}

export default class BountyHandler {

    /**
     * Builds the bounty card. `bounty.imageUrl` / `bounty.screenshotUrl` are either external URLs or
     * `attachment://<name>` references to files attached to the card message itself.
     */
    public static buildCard(bounty: Bounty): ContainerBuilder {
        const isCompleted = bounty.status === 'completed';
        const description = bounty.description ?? DEFAULT_BOUNTY_DESCRIPTION;
        const thumbnailUrl = bounty.imageUrl;

        const textDisplays = [
            new TextDisplayBuilder().setContent(isCompleted
                ? `## Bounty Completed!\n\n**${bounty.item}** has been claimed!`
                : `## New Bounty!\n\n**${bounty.item}** has been added to the bounty list!`),
            new TextDisplayBuilder().setContent(`-# ${description}`)
        ];

        const container = new ContainerBuilder().setAccentColor(isCompleted ? BOUNTY_COMPLETED_ACCENT_COLOUR : BOUNTY_ACCENT_COLOUR);

        if (thumbnailUrl) {
            container.addSectionComponents(section => section
                .addTextDisplayComponents(...textDisplays)
                .setThumbnailAccessory(thumbnail => thumbnail.setURL(thumbnailUrl).setDescription(bounty.item))
            );
        } else {
            container.addTextDisplayComponents(...textDisplays);
        }

        if (isCompleted && bounty.screenshotUrl) {
            const screenshotUrl = bounty.screenshotUrl;
            container.addMediaGalleryComponents(gallery => gallery
                .addItems(item => item.setURL(screenshotUrl).setDescription(`${bounty.item} bounty screenshot`))
            );
        }

        container
            .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(text => text.setContent(`**Reward:** ${bounty.reward}`));

        if (isCompleted && bounty.winnerId) {
            container.addTextDisplayComponents(text => text.setContent(`**Winner:** <@${bounty.winnerId}>`));
        }

        return container;
    }

    /**
     * Downloads an uploaded file and re-attaches it so the card doesn't depend on the (expiring) CDN link
     * of the slash-command attachment. Returns the attachment and its `attachment://` reference.
     */
    private static async reattach(image: Required<BountyImage>, prefix: string): Promise<{ file: AttachmentBuilder, ref: string }> {
        const response = await axios.get(image.url, { responseType: 'arraybuffer' });
        const fileName = `${prefix}_${Date.now()}_${image.name.replace(/[^\w.-]/g, '_')}`;
        return { file: new AttachmentBuilder(Buffer.from(response.data), { name: fileName }), ref: `attachment://${fileName}` };
    }

    /** Posts the bounty card to the guild's bounty channel and stores the resulting message on the bounty. */
    public static async postBounty(client: Bot, bounty: Bounty, image: BountyImage | null): Promise<TextChannel> {
        const channel = await client.channels.fetch(bounty.channelId) as TextChannel | null;
        if (!channel) {
            throw new Error(`Bounty channel ${bounty.channelId} could not be found`);
        }

        const files: AttachmentBuilder[] = [];
        bounty.imageUrl = null;

        if (image?.name) {
            const { file, ref } = await BountyHandler.reattach({ url: image.url, name: image.name }, 'bounty');
            files.push(file);
            bounty.imageUrl = ref;
        } else if (image) {
            bounty.imageUrl = image.url;
        }

        const message = await channel.send({
            components: [BountyHandler.buildCard(bounty)],
            files,
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        bounty.messageId = message.id;
        await client.dataSource.getRepository(Bounty).save(bounty);

        return channel;
    }

    /** Marks the bounty as completed and edits its card in place (green accent, screenshot, winner). */
    public static async completeBounty(client: Bot, bounty: Bounty, winnerId: string, completedBy: string, screenshot: Required<BountyImage>): Promise<Message> {
        const channel = await client.channels.fetch(bounty.channelId) as TextChannel | null;
        if (!channel) {
            throw new Error(`Bounty channel ${bounty.channelId} could not be found`);
        }

        const message = await channel.messages.fetch(bounty.messageId!);
        const { file, ref } = await BountyHandler.reattach(screenshot, 'bounty_screenshot');
        const files = [file];

        // Components V2 messages don't list their files in `message.attachments`, so the thumbnail can't be kept on
        // edit. Re-upload it from the card's current (freshly signed) thumbnail URL instead.
        const thumbnail = BountyHandler.findThumbnailMedia(message);
        if (thumbnail?.attachment_id) {
            const fileName = bounty.imageUrl?.startsWith('attachment://')
                ? bounty.imageUrl.substring('attachment://'.length)
                : new URL(thumbnail.url).pathname.split('/').pop()!;
            const response = await axios.get(thumbnail.url, { responseType: 'arraybuffer' });
            files.push(new AttachmentBuilder(Buffer.from(response.data), { name: fileName }));
            bounty.imageUrl = `attachment://${fileName}`;
        }

        bounty.status = 'completed';
        bounty.winnerId = winnerId;
        bounty.screenshotUrl = ref;
        bounty.completedBy = completedBy;
        bounty.completedAt = new Date();

        await message.edit({
            components: [BountyHandler.buildCard(bounty)],
            files,
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

        await client.dataSource.getRepository(Bounty).save(bounty);

        return message;
    }

    /** Finds the thumbnail accessory's media (URL + attachment id) in a posted bounty card. */
    private static findThumbnailMedia(message: Message): { url: string, attachment_id?: string } | null {
        const search = (node: any): { url: string, attachment_id?: string } | null => {
            if (!node || typeof node !== 'object') return null;
            if (node.type === ComponentType.Thumbnail && node.media?.url) return node.media;
            for (const value of Object.values(node)) {
                const found = search(value);
                if (found) return found;
            }
            return null;
        };

        return search(message.components.map(component => component.toJSON()));
    }
}
