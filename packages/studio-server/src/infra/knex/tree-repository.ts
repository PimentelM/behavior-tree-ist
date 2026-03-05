import type { Knex } from 'knex';
import type { SerializableNode } from '@behavior-tree-ist/core';
import { BaseKnexRepository } from './base-repository';
import { TreeRepositoryInterface } from '../../domain/interfaces';
import type { DbTree } from './schemas';
import { mapDbTreeToDomain, mapTreeToDb } from './mappers';

export class TreeRepository extends BaseKnexRepository implements TreeRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findBySession(clientId: string, sessionId: string) {
        const rows = await this.withTransaction(
            this.knex<DbTree>('trees')
                .where({ clientId, sessionId })
                .orderBy('updatedAt', 'desc')
        );
        return rows.map(mapDbTreeToDomain);
    }

    async upsert(clientId: string, sessionId: string, treeId: string, serializedTree: SerializableNode): Promise<void> {
        const now = Date.now();
        const dbTree = mapTreeToDb({
            clientId,
            sessionId,
            treeId,
            serializedTree,
            removedAt: undefined,
            updatedAt: now,
        });

        await this.withTransaction(
            this.knex('trees')
                .insert(dbTree)
                .onConflict(['clientId', 'sessionId', 'treeId'])
                .merge({
                    serializedTreeJson: dbTree.serializedTreeJson,
                    removedAt: dbTree.removedAt,
                    updatedAt: dbTree.updatedAt,
                })
        );
    }

    async markRemoved(clientId: string, sessionId: string, treeId: string): Promise<void> {
        await this.withTransaction(
            this.knex('trees')
                .where({ clientId, sessionId, treeId })
                .update({ removedAt: Date.now(), updatedAt: Date.now() })
        );
    }

    async findById(clientId: string, sessionId: string, treeId: string) {
        const row = await this.withTransaction(
            this.knex<DbTree>('trees')
                .where({ clientId, sessionId, treeId })
                .first()
        );
        return row ? mapDbTreeToDomain(row) : undefined;
    }
}
