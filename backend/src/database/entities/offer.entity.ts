import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Raw, store-specific labels exactly as scraped. Kept so offers can be re-classified later. */
export interface RawLabels {
    category?: string;
    subcategory?: string;
    gender?: string;
    age?: string;
    color?: string;
    breadcrumbs?: string[];
}

/**
 * One store's listing of a product (price + link). Scrapers only ever write
 * offers; classification and clustering into `products` happen afterwards.
 */
@Entity('offers')
@Index(['store', 'externalKey'], { unique: true })
export class Offer {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    store: string;

    /** Stable per-store identity (normalized product URL). */
    @Column()
    externalKey: string;

    @Index()
    @Column({ nullable: true })
    productId?: string | null;

    @Column()
    url: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    brand?: string;

    @Column({ nullable: true })
    modelCode?: string;

    @Column({ nullable: true })
    image?: string;

    @Column('int', { nullable: true })
    price?: number | null;

    @Column('jsonb', { default: {} })
    rawLabels: RawLabels;

    /** Hints from the crawl entry point (e.g. the "men/shoes" listing page). */
    @Column('jsonb', { default: {} })
    hints: RawLabels;

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

    /** rules | mapping | gemini | default | legacy */
    @Column({ nullable: true })
    classificationSource?: string;

    @Index()
    @Column({ type: 'timestamp', nullable: true })
    classifiedAt?: Date | null;

    @Index()
    @Column({ type: 'timestamp' })
    lastSeenAt: Date;

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;
}
