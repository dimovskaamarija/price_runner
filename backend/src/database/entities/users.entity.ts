import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    authkit_id: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    name: string;
}
