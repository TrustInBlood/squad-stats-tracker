const { sequelize } = require('../database/models');
const logger = require('./logger');

const weaponCache = new Map();

async function initializeWeaponCache() {
  try {
    const weapons = await sequelize.models.Weapon.findAll();
    weapons.forEach(w => weaponCache.set(w.name, w.id));
    logger.info('Weapon cache initialized', { count: weaponCache.size });
  } catch (error) {
    logger.error('Failed to initialize weapon cache:', { message: error.message, stack: error.stack });
    throw error;
  }
}

async function getWeaponId(name, transaction) {
  if (!name) return null;
  if (weaponCache.has(name)) return weaponCache.get(name);
  try {
    await sequelize.models.Weapon.upsert(
      { name },
      { transaction }
    );
    const weapon = await sequelize.models.Weapon.findOne({
      where: { name },
      transaction
    });
    weaponCache.set(name, weapon.id);
    logger.debug('Weapon upserted', { name, id: weapon.id });
    return weapon.id;
  } catch (error) {
    logger.error('Failed to upsert weapon:', { message: error.message, stack: error.stack });
    throw error;
  }
}

module.exports = { initializeWeaponCache, getWeaponId };