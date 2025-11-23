import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('price_history')
@Index(['productId', 'store', 'date'])
export class PriceHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    productId: string;

    @Column()
    store: string;

    @Column('decimal', { precision: 10, scale: 2 })
    price: number;

    @CreateDateColumn()
    date: Date;
}