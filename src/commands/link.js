const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DiscordSteamLink } = require('../database/models');
const { command: logger } = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Discord account with your Squad Steam account')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('What to do with your account link')
                .setRequired(false)
                .addChoices(
                    { name: 'Start Link', value: 'start' },
                    { name: 'Check Status', value: 'status' },
                    { name: 'Cancel Link', value: 'cancel' }
                )),

    async execute(interaction) {
        try {
            const action = interaction.options.getString('action') || 'start';
            const discordID = interaction.user.id;

            switch (action) {
                case 'start':
                    await this.handleStartLink(interaction, discordID);
                    break;
                case 'status':
                    await this.handleCheckStatus(interaction, discordID);
                    break;
                case 'cancel':
                    await this.handleCancelLink(interaction, discordID);
                    break;
            }
        } catch (error) {
            logger.error('Error in link command', { error });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error processing your request. Please try again later.',
                    ephemeral: true
                });
            }
        }
    },

    async handleStartLink(interaction, discordID) {
        // Check if user already has a verified link
        const existingLink = await DiscordSteamLink.getActiveLink(discordID);
        if (existingLink) {
            await interaction.reply({
                content: `You already have a verified link with Steam ID: ${existingLink.steamID}\nUse \`/link action:status\` to check your link status.`,
                ephemeral: true
            });
            return;
        }

        // Create new link request without Steam ID (will be set during verification)
        const { link, isNew, error } = await DiscordSteamLink.createLinkRequest(discordID);
        
        if (error) {
            logger.error('Error creating link request', { error, discordID });
            await interaction.reply({
                content: 'There was an error creating your link request. Please try again later.',
                ephemeral: true
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Account Link Request')
            .setDescription('To verify your account, follow these steps:')
            .addFields(
                { name: 'Step 1', value: 'Join any of our Squad servers' },
                { name: 'Step 2', value: `Type this code in the in-game chat: \`${link.verificationCode}\`` },
                { name: 'Step 3', value: 'Wait for the bot to confirm your verification' },
                { name: 'Verification Code', value: `\`${link.verificationCode}\`` },
                { name: 'Expires', value: `<t:${Math.floor(link.verificationExpires.getTime() / 1000)}:R>` }
            )
            .setFooter({ text: 'The verification code will expire in 15 minutes' });

        // Reply with the embed
        await interaction.reply({ embeds: [embed], ephemeral: true });

        // Store the interaction message with the chat verification handler
        const chatVerificationHandler = interaction.client.chatVerificationHandler;
        if (chatVerificationHandler) {
            logger.debug('Storing verification message in handler', { 
                code: link.verificationCode,
                interactionId: interaction.id,
                hasHandler: !!chatVerificationHandler
            });
            chatVerificationHandler.storeVerificationMessage(link.verificationCode, interaction);
        } else {
            logger.error('Chat verification handler not found on client');
        }

        logger.info('Link request created', { discordID, code: link.verificationCode });
    },

    async handleCheckStatus(interaction, discordID) {
        const activeLink = await DiscordSteamLink.getActiveLink(discordID);
        const pendingLink = await DiscordSteamLink.findOne({
            where: {
                discordID,
                isVerified: false,
                verificationExpires: {
                    [DiscordSteamLink.sequelize.Sequelize.Op.gt]: new Date()
                }
            }
        });

        if (activeLink) {
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Account Link Status')
                .setDescription('Your account is successfully linked!')
                .addFields(
                    { name: 'Steam ID', value: activeLink.steamID },
                    { name: 'Linked On', value: `<t:${Math.floor(activeLink.verifiedAt.getTime() / 1000)}:F>` },
                    { name: 'Confidence', value: activeLink.confidence }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            logger.debug('Status check - active link found', { discordID, steamID: activeLink.steamID });
        } else if (pendingLink) {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('Pending Link Request')
                .setDescription('You have a pending link request:')
                .addFields(
                    { name: 'Verification Code', value: `\`${pendingLink.verificationCode}\`` },
                    { name: 'Expires', value: `<t:${Math.floor(pendingLink.verificationExpires.getTime() / 1000)}:R>` }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            logger.debug('Status check - pending link found', { discordID, code: pendingLink.verificationCode });
        } else {
            await interaction.reply({
                content: 'You have no active or pending account links. Use `/link` to start the linking process.',
                ephemeral: true
            });
            logger.debug('Status check - no links found', { discordID });
        }
    },

    async handleCancelLink(interaction, discordID) {
        const pendingLink = await DiscordSteamLink.findOne({
            where: {
                discordID,
                isVerified: false,
                verificationExpires: {
                    [DiscordSteamLink.sequelize.Sequelize.Op.gt]: new Date()
                }
            }
        });

        if (!pendingLink) {
            await interaction.reply({
                content: 'You have no pending link requests to cancel.',
                ephemeral: true
            });
            logger.debug('Cancel attempt - no pending link found', { discordID });
            return;
        }

        await pendingLink.destroy();
        await interaction.reply({
            content: 'Your pending link request has been cancelled.',
            ephemeral: true
        });
        logger.info('Link request cancelled', { discordID, code: pendingLink.verificationCode });
    }
}; 