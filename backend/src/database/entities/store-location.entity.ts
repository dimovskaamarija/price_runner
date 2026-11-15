import { Entity, Column, PrimaryColumn, UpdateDateColumn, Index } from 'typeorm';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/** Opening hours per weekday ("09:00"–"21:00"); null = closed; whole object null = unknown. */
export type WeeklyHours = Record<Weekday, { from: string; to: string } | null>;

/** A physical shop of one of the chains (for the "stores near me" map). */
@Entity('store_locations')
export class StoreLocation {
    /** `${chain}:${external id}` — stable across syncs. */
    @PrimaryColumn()
    id: string;

    /** Same store name as offers.store (e.g. "Sport Vision MK"), to link shops with prices. */
    @Index()
    @Column()
    store: string;

    @Column()
    name: string;

    @Column({ type: 'varchar', nullable: true })
    address: string | null;

    @Column({ type: 'varchar', nullable: true })
    city: string | null;

    @Column('double precision')
    lat: number;

    @Column('double precision')
    lng: number;

    /** true when the position was geocoded from the address (may be off by a few hundred metres). */
    @Column({ default: false })
    approximate: boolean;

    @Column({ type: 'varchar', nullable: true })
    phone: string | null;

    @Column({ type: 'jsonb', nullable: true })
    hours: WeeklyHours | null;

    @Column({ type: 'varchar', nullable: true })
    url: string | null;

    @UpdateDateColumn()
    updatedAt?: Date;
}
