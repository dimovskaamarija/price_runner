import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * Price change log. A row is written only when an offer's price differs from
 * its previous price, so the table grows with price *changes*, not days.
 */
@Entity('price_history')
@Index(['offerId', 'date'])
export class PriceHistory {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    offerId: number;

    @Column('int')
    price: number;

    @Column({ type: 'timestamp' })
    date: Date;
}
