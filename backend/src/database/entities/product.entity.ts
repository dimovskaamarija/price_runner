import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Canonical product: one row per real-world product, shared by every store
 * that sells it. Store-specific data (price, link) lives in `offers`.
 *
 * `minPrice` and `storeCount` are denormalized from active offers by
 * CatalogMaintenanceService so listing/filtering/sorting runs fully in SQL.
 */
@Entity('products')
@Index(['category', 'subcategory'])
export class Product {
    @PrimaryColumn()
    id: string;

    @Column()
    name: string;

    @Index()
    @Column({ nullable: true })
    brand?: string;

    @Column({ nullable: true })
    category?: string;

    @Column({ nullable: true })
    subcategory?: string;

    @Column({ nullable: true })
    gender?: string;

    @Column({ nullable: true })
    age?: string;

    @Column({ nullable: true })
    color?: string;

    @Column({ nullable: true })
    image?: string;

    /** Result of the image URL check: null = not checked yet, false = broken (product hidden). */
    @Column({ type: 'boolean', nullable: true })
    imageOk?: boolean | null;

    /** Normalized manufacturer style code (e.g. "IB6651300"), used to match offers across stores. */
    @Index()
    @Column({ nullable: true })
    modelCode?: string;

    @Index()
    @Column('int', { nullable: true })
    minPrice?: number | null;

    @Index()
    @Column('int', { default: 0 })
    storeCount: number;

    /** Optional Gemini embedding used for fuzzy clustering when no model code matches. */
    @Column('real', { array: true, nullable: true, select: false })
    embedding?: number[] | null;

    @Column({ nullable: true, default: 'MKD' })
    currency?: string;

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;
}
