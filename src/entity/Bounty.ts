import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class Bounty {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    item: string

    @Column()
    reward: string

    @Column({ type: 'text', nullable: true })
    description: string | null

    @Column({ type: 'text', nullable: true })
    imageUrl: string | null

    @Column()
    channelId: string

    @Column({ type: 'text', nullable: true })
    messageId: string | null

    @Column()
    createdBy: string

    // open | completed | cancelled
    @Column({ default: 'open' })
    status: string

    @Column({ type: 'text', nullable: true })
    winnerId: string | null

    @Column({ type: 'text', nullable: true })
    screenshotUrl: string | null

    @Column({ type: 'text', nullable: true })
    completedBy: string | null

    @Column({ type: 'datetime', nullable: true })
    completedAt: Date | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date
}
