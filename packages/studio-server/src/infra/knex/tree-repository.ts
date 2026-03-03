import type { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { TreeRepositoryInterface, TreeRow } from '../../domain/interfaces';

export class TreeRepository extends BaseKnexRepository implements TreeRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findBySession(clientId: string, sessionId: string): Promise<TreeRow[]> {
        return this.withTransaction(
            this.knex<TreeRow>('trees')
                .where({ client_id: clientId, session_id: sessionId })
                .orderBy('updated_at', 'desc')
        );
    }

    async upsert(clientId: string, sessionId: string, treeId: string, serializedTreeJson: string): Promise<void> {
        const now = Date.now();
        const existing = await this.findById(clientId, sessionId, treeId);
        if (existing) {
            await this.withTransaction(
                this.knex('trees')
                    .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                    .update({ serialized_tree_json: serializedTreeJson, removed_at: null, updated_at: now })
            );
        } else {
            await this.withTransaction(
                this.knex('trees').insert({
                    client_id: clientId,
                    session_id: sessionId,
                    tree_id: treeId,
                    serialized_tree_json: serializedTreeJson,
                    removed_at: null,
                    updated_at: now,
                })
            );
        }
    }

    async markRemoved(clientId: string, sessionId: string, treeId: string): Promise<void> {
        await this.withTransaction(
            this.knex('trees')
                .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                .update({ removed_at: Date.now(), updated_at: Date.now() })
        );
    }

    async findById(clientId: string, sessionId: string, treeId: string): Promise<TreeRow | undefined> {
        return this.withTransaction(
            this.knex<TreeRow>('trees')
                .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                .first()
        );
    }
}
