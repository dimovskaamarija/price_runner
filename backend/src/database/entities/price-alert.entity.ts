import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export type AlertType = 'target' | 'change';

/**
 * A price alert on a product's lowest price.
 *   target - email once the lowest price is at or below `targetPrice` (re-arms when it rises above)
 *   change - email whenever the lowest price changes, up or down
 * Guests confirm their email first (`confirmed`); every email carries `token` for one-click unsubscribe.
 */
@Entity('price_alerts')
@Index(['productId'])
@Index(['email'])
export class PriceAlert {
    @PrimaryGeneratedColumn()
    id: number;

    /** Random secret used in confirm / unsubscribe links. */
    @Index({ unique: true })
    @Column()
    token: string;

    @Column()
    productId: string;

    @Column({ type: 'int', nullable: true })
    userId: number | null;

    @Column()
    email: string;

    @Column({ type: 'varchar' })
    type: AlertType;

    @Column({ type: 'int', nullable: true })
    targetPrice: number | null;

    /** Lowest price at the last check/notification; the baseline for "changed". */
    @Column({ type: 'int', nullable: true })
    lastPrice: number | null;

    /** Target alerts: already notified while the price is at/below target. */
    @Column({ default: false })
    triggered: boolean;

    @Column({ default: false })
    confirmed: boolean;

    @Column({ default: true })
    active: boolean;

    /** Language of the emails ("mk" / "en"), taken from the site language when created. */
    @Column({ type: 'varchar', length: 2, default: 'mk' })
    lang: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    lastNotifiedAt: Date | null;
}
