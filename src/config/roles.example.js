module.exports = {
  // Hierarchical role system - higher index = higher permission level
  roleHierarchy: {
    'staff': 1,
    'admin': 2,
    'senior_admin': 3,
    'head_admin': 4
  },
  
  // Role IDs mapped to role names (replace with your actual Discord role IDs)
  roleIds: {
    // Staff roles
    'staff': [
      '1234567890123456789', // Replace with actual role IDs
      '9876543210987654321'
    ],
    
    // Admin roles
    'admin': [
      '1111111111111111111',
      '2222222222222222222'
    ],
    
    // Senior Admin roles
    'senior_admin': [
      '3333333333333333333',
      '4444444444444444444'
    ],
    
    // Head Admin roles
    'head_admin': [
      '5555555555555555555',
      '6666666666666666666'
    ]
  },
  
  // Command permission requirements
  commandPermissions: {
    // Kill tracking commands (killedby, killed)
    killTracking: 'staff',
    
    // Database management commands
    database: 'senior_admin',
    
    // Server management commands
    serverManagement: 'admin',
    
    // Bot configuration commands
    botConfig: 'head_admin'
  },
  
  // Helper function to get user's highest role level
  getUserRoleLevel: (member) => {
    if (!member) return 0;
    
    let highestLevel = 0;
    
    for (const [roleName, roleIds] of Object.entries(module.exports.roleIds)) {
      if (member.roles.cache.some(role => roleIds.includes(role.id))) {
        const level = module.exports.roleHierarchy[roleName];
        if (level > highestLevel) {
          highestLevel = level;
        }
      }
    }
    
    return highestLevel;
  },
  
  // Helper function to check if user has required permission level
  hasPermission: (member, requiredRole) => {
    const userLevel = module.exports.getUserRoleLevel(member);
    const requiredLevel = module.exports.roleHierarchy[requiredRole];
    
    return userLevel >= requiredLevel;
  },
  
  // Helper function to check if user can use a specific command
  canUseCommand: (member, commandType) => {
    const requiredRole = module.exports.commandPermissions[commandType];
    if (!requiredRole) return false;
    
    return module.exports.hasPermission(member, requiredRole);
  },
  
  // Helper function to get all roles a user has
  getUserRoles: (member) => {
    if (!member) return [];
    
    const userRoles = [];
    for (const [roleName, roleIds] of Object.entries(module.exports.roleIds)) {
      if (member.roles.cache.some(role => roleIds.includes(role.id))) {
        userRoles.push(roleName);
      }
    }
    
    return userRoles;
  },
  
  // Helper function to check if user has a specific role
  hasRole: (member, roleName) => {
    const roleIds = module.exports.roleIds[roleName];
    if (!roleIds) return false;
    
    return member.roles.cache.some(role => roleIds.includes(role.id));
  }
}; 