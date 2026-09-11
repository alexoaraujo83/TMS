import { Global, Module } from '@nestjs/common';
import { createDatabasePool } from '@tms/database';
import { DATABASE_POOL } from './database.provider.js';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL is required');
        return createDatabasePool({ connectionString });
      },
    },
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
