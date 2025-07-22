import {
	spin_lock_yld,
    spin_unlock,
} from './spinlock.js'

function Semaphore(lock, val, queue_head, queue_tail) {
	this.lock = lock;
	this.val = val;
	this.queue_head = queue_head;
	this.queue_tail = queue_tail;
}

const sem_wait = (s, tid, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(s.lock, t0),
	
	`lod  ${t0}, ${s.val}`,
	`bfs  ${t0}, sem_wait_slow_${id}`,
	
	/* The fast */
	`adi  ${t0}, -1`,
	`sto  ${t0}, ${s.val}`,
	...spin_unlock(s.lock, t0),
	`br   sem_wait_end_${id}`,
	
	/* The slow */
	`lab  sem_wait_slow_${id}`,
	`lod  ${t0}, ${s.queue_tail}`,
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,
	`adi  ${t0}, 1`,
	`sto  ${t0}, ${s.queue_tail}`,
	...spin_unlock(s.lock),
	// out of critical area, to avoid deadlock
	`blk`,
	
	`lab  sem_wait_end_${id}`,
]};

const sem_post = (s, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(s.lock),
	
	`lod  ${t0}, ${s.queue_head}`,
	`lod  ${t1}, ${s.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, sem_post_empty_${id}`,
	
	/* queue non-empty */
	`lod  ${t0}, ${s.queue_head}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	`adi  ${t0}, +1`,
	`sto  ${t0}, ${s.queue_head}`,
	...spin_unlock(s.lock),
	// out of critical area, to avoid competetion for lock
	`pst  ${t1}`,
	`br   sem_post_end_${id}`,
	
	/* queue empty */
	`lab  sem_post_empty_${id}`,
	`lod  ${t0}, ${s.val}`,
	`adi  ${t0}, +1`,
	`sto  ${t0}, ${s.val}`,
	...spin_unlock(s.lock),
	
	`lab  sem_post_end_${id}`,
]};

const sem_show = (s, t0) => [
	`lod  ${t0}, ${s.val}`,
	`prt  ${t0}`,
];
