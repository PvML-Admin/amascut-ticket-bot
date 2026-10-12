import LeaderboardHandler from '../../modules/LeaderboardHandler';
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js';

export default class TeacherLeaderboard extends BotInteraction {
    get name() {
        return 'teacher-leaderboard';
    }

    get description() {
        return 'Teacher Leaderboards';
    }

    get permissions() {
        return 'TEACHER';
    }

    get timespanOptions() {
        const timespanTypes: any = {
            'Current Month': 'currentMonth',
            'Last Month': 'lastMonth',
            'Last 3 Months': 'lastThreeMonths',
            'Current Year': 'currentYear',
            'Last Year': 'lastYear',
            'All Time': 'allTime',
        }
        const options: any = [];
        Object.keys(timespanTypes).forEach((key: string) => {
            options.push({ name: key, value: timespanTypes[key] })
        })
        return options;
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption((option) => option.setName('timespan').setDescription('Time Span').addChoices(
                ...this.timespanOptions
            ).setRequired(false));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const timespan: string | null = interaction.options.getString('timespan', false);

        await LeaderboardHandler.postLeaderBoard(this.client, 0, interaction.channel as TextChannel, timespan ?? null)

        await interaction.editReply('Leaderboard sent!');
    }
}
