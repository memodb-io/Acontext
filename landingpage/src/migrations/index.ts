import * as migration_20260105_141440 from './20260105_141440';
import * as migration_20260129_072315_add_faq from './20260129_072315_add_faq';

export const migrations = [
  {
    up: migration_20260105_141440.up,
    down: migration_20260105_141440.down,
    name: '20260105_141440'
  },
  {
    up: migration_20260129_072315_add_faq.up,
    down: migration_20260129_072315_add_faq.down,
    name: '20260129_072315_add_faq'
  },
];
