import { Generated } from 'kysely';

export interface ResourceTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  resources: ResourceTable;
}

export interface Resource {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
