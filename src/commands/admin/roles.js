const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const roleConfig = require('../../config/roles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('View role information and permissions')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check roles for (optional)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    // Check if user has permission to use this command
    if (!roleConfig.canUseCommand(interaction.member, 'killTracking')) {
      return interaction.reply({ 
        content: 'You do not have permission to use this command.',
        ephemeral: true 
      });
    }

    const targetUser = interaction.options.getUser('user');
    const member = targetUser ? 
      await interaction.guild.members.fetch(targetUser.id) : 
      interaction.member;

    const userRoles = roleConfig.getUserRoles(member);
    const userLevel = roleConfig.getUserRoleLevel(member);
    const highestRole = userRoles.length > 0 ? 
      userRoles.reduce((a, b) => 
        roleConfig.roleHierarchy[a] > roleConfig.roleHierarchy[b] ? a : b
      ) : 'none';

    const embed = new EmbedBuilder()
      .setTitle('Role Information')
      .setColor('#0099ff')
      .addFields(
        {
          name: 'User',
          value: member.user.tag,
          inline: true
        },
        {
          name: 'Role Level',
          value: userLevel.toString(),
          inline: true
        },
        {
          name: 'Highest Role',
          value: highestRole,
          inline: true
        },
        {
          name: 'All Roles',
          value: userRoles.length > 0 ? userRoles.join(', ') : 'None',
          inline: false
        }
      );

    // Add command permissions
    const commandPermissions = [];
    for (const [commandType, requiredRole] of Object.entries(roleConfig.commandPermissions)) {
      const canUse = roleConfig.canUseCommand(member, commandType);
      commandPermissions.push(`${commandType}: ${canUse ? '✅' : '❌'} (requires: ${requiredRole})`);
    }

    embed.addFields({
      name: 'Command Permissions',
      value: commandPermissions.join('\n'),
      inline: false
    });

    // Add role hierarchy info
    const hierarchyInfo = Object.entries(roleConfig.roleHierarchy)
      .sort(([,a], [,b]) => a - b)
      .map(([role, level]) => `${role}: level ${level}`)
      .join('\n');

    embed.addFields({
      name: 'Role Hierarchy',
      value: hierarchyInfo,
      inline: false
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}; 