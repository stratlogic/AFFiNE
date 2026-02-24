import {
  defineModuleConfig,
  StorageJSONSchema,
  StorageProviderConfig,
} from '../../base';

export interface Storages {
  avatar: {
    storage: ConfigItem<StorageProviderConfig>;
    publicPath: string;
  };
  blob: {
    storage: ConfigItem<StorageProviderConfig>;
  };
}

declare global {
  interface AppConfigSchema {
    storages: Storages;
  }
}

defineModuleConfig('storages', {
  'avatar.publicPath': {
    desc: 'The public accessible path prefix for user avatars.',
    default: '/api/avatars/',
  },
  'avatar.storage': {
    desc: 'The config of storage for user avatars.',
    default: {
      provider: 'aws-s3',
      bucket: 'avatars',
      config: {
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        region: process.env.MINIO_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        },
        forcePathStyle: true,
      },
    },
    schema: StorageJSONSchema,
  },
  'blob.storage': {
    desc: 'The config of storage for all uploaded blobs(images, videos, etc.).',
    default: {
      provider: 'aws-s3',
      bucket: 'blobs',
      config: {
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        region: process.env.MINIO_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        },
        forcePathStyle: true,
      },
    },
    schema: StorageJSONSchema,
  },
});
