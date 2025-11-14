import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
    @PrimaryColumn()
    id: string;

    @Column()
    name: string;

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

    @Column('jsonb', { nullable: true, default: {} })
    priceMap?: Record<string, number | null>;

    @Column('jsonb', { nullable: true, default: {} })
    storeLinks?: Record<string, string>;

    @Column({ nullable: true })
    productUrl?: string;

    @Column({ nullable: true, default: 'MKD' })
    currency?: string;

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;
}

