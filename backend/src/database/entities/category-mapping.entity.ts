import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export type MappingKind = 'category' | 'subcategory' | 'gender' | 'age' | 'color';

/**
 * Learned mapping from a raw store label to a canonical taxonomy value.
 * Filled by Gemini the first time an unknown label is seen, so every label is
 * sent to the LLM at most once. Rows with source = 'manual' are admin overrides.
 * `value = null` means "this label carries no information for this kind".
 */
@Entity('category_mappings')
@Index(['kind', 'raw'], { unique: true })
export class CategoryMapping {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    kind: MappingKind;

    @Column()
    raw: string;

    @Column({ type: 'varchar', nullable: true })
    value: string | null;

    @Column({ default: 'gemini' })
    source: string;

    @CreateDateColumn()
    createdAt?: Date;
}
