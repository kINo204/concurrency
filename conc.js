const MEM_SIZE = 50, REG_SIZE = 5, SLICE = 20;

class Frame {
	pc = 0;
	regs = new Array(REG_SIZE).fill(0);
}
	
class Scheduler {
	running = null;
	memory = new Array(MEM_SIZE).fill(0);  // shared user-space memory
	frame = new Frame;  // the frame currently in use
	ready; blocked; pstmsg;
	
	constructor(threads, action) {
		this.ready = threads;
		this.blocked = {};
		this.pstmsg = {};
		if (action) {
			action(this);
		}
		this.#parse_labels(threads);
	}
	
	#parse_labels(threads) {
		for (let tid in threads) {
			let t = threads[tid];
			t.labels = {};
			for (let c of t.cmds) {
				const [op, sa, sb] = c.split(/\s*,?\s+/, 3);
				if (op === 'lab') {
					t.labels[sa] = t.cmds.indexOf(c);
				}
			}
		}
	}
	
	#execute(cmd) {
		const goto = (addr) => {
			if (addr[0] === ':') {
				const target = parseInt(addr.slice(1));
				this.frame.pc += target;
			} else {
				if (parseInt(addr)) {
					this.frame.pc = parseInt(addr);
				} else {
					this.frame.pc = this.running.labels[addr];
				}
			}
		}
		
		const print_cmd = ([op, sa, sb]) => {
			if (!sa) {
				console.log(`${op}`);
			} else if (!sb) {
				console.log(`${op}\t${sa}`);
			} else {
				console.log(`${op}\t${sa}, ${sb}`);
			}
		}

		const [op, sa, sb] = cmd.split(/\s*,?\s+/, 3);
		const [a, b] = [sa, sb].map(s => parseInt(s));
		print_cmd([op, sa, sb]);
		
		switch (op) {
		case 'lab':
			this.frame.pc++;
			break;
		case 'prt':
			console.log(this.frame.regs[a]);
			this.frame.pc++;
			break;
		case 'imm':
			this.frame.regs[a] = b;
			this.frame.pc++;
			break;
		case 'add':
			this.frame.regs[a] += this.frame.regs[b];
			this.frame.pc++;
			break;
		case 'sub':
			this.frame.regs[a] -= this.frame.regs[b];
			this.frame.pc++;
			break;
		case 'lod':
			this.frame.regs[a] = this.memory[b];
			this.frame.pc++;
			break;
		case 'sto':
			this.memory[b] = this.frame.regs[a];
			this.frame.pc++;
			break;
		case 'ldr':
			this.frame.regs[a] = this.memory[this.frame.regs[b]];
			this.frame.pc++;
			break;
		case 'str':
			this.memory[this.frame.regs[b]] = this.frame.regs[a]
			this.frame.pc++;
			break;
		case 'br':
			goto(sa);
			break;
		case 'btr':
			if (this.frame.regs[a]) goto(sb);
			else this.frame.pc++;
			break;
		case 'bfs':
			if (!this.frame.regs[a]) goto(sb);
			else this.frame.pc++;
			break;
		case 'cas':
			this.frame.regs[a] = this.memory[b];
			if (!this.memory[b]) {
				this.memory[b] = 1;
			}
			this.frame.pc++;
			break;
		case 'yld':
			this.frame.pc++;
			return 'yield';
		case 'blk':
			this.frame.pc++;
			return 'block';
		case 'pst':
			const tid_pst = this.frame.regs[a];
			if (this.blocked[tid_pst]) { // blocking
				this.ready[tid_pst] = this.blocked[tid_pst];
				delete this.blocked[tid_pst];
			} else {
				this.pstmsg[tid_pst] = true;
			}
			this.frame.pc++;
			break;
		default:
			this.frame.pc++;
			throw new SyntaxError('Undefined instruction');
		}
	}
	
	loop() {
		while (true) {
			const running = Object.keys(this.ready);
			if (!running.length) break;
			for (const tid of running) {
				console.log(`\x1B[34m"${tid}"\x1B[0m`);
				const thread = this.ready[tid];
				this.running = thread;
				this.frame = thread.frame;
				let j = 0;
				for (; j < SLICE; j++) {
					// The thread is over:
					if (this.frame.pc >= thread.cmds.length) {
						delete this.ready[tid];
						console.log(`\x1B[31mthread "${tid}" exits\x1B[0m`);
						break;
					}
					try {
						const response = this.#execute(
							thread.cmds[this.frame.pc]);
						if (response === 'yield') {
							break;
						} else if (response === 'block') {
							if (this.pstmsg[tid]) {
								this.pstmsg[tid] = false;
							} else {
								this.blocked[tid] = this.ready[tid];
								delete this.ready[tid];
								break;
							}
						}
					} catch (e) {
						console.log(e.message);
					}
				}
				console.log(`\x1B[34m${j} slices run\x1B[0m\n`);
			}
		}
	}
}


/* 1. Spin-Lock */
const spin_lock = (lock, t) => [
	`cas  ${t}, ${lock}`,
	`btr  ${t}, :-1`, ];
	
const spin_trylock = (lock, t) => [
	`cas  ${t}, ${lock}`, ];
	
const spin_unlock = (lock, t) => [
	`imm  ${t}, 0`,
	`sto  ${t}, ${lock}`, ];

const run_spin_lock = new Scheduler({
	'Thread-0': {
		frame: new Frame,
		cmds: [
			...spin_lock(1, 0),
			
			'imm  0, 123',
			'sto  0, 0',
			'lod  0, 0',
			'prt  0',
			
			...spin_unlock(1, 0),
		]
	},
	'Thread-1': {
		frame: new Frame,
		cmds: [
			...spin_lock(1, 0),
			
			'imm  0, 456',
			'sto  0, 0',
			
			...spin_unlock(1, 0),
		]
	},
});

const spin_lock_yld = (lock, t) => [
	`cas  ${t}, ${lock}`,	// check the lock
	`bfs  ${t}, :+3`,		// go in if lock acquired
	`yld`,					// else yld, and try again next time
	`br   :-3`,
	/* We may also yield only after a few spins;
	   Just spinning for ONE time here. */ ];

const run_spin_lock_with_yld = new Scheduler({
	'Thread-0': {
		frame: new Frame,
		cmds: [
			...spin_lock_yld(0, 2),
			
			'imm  0, -1',
			'imm  1, 50',
			'add  1, 0',
			'prt  1',
			'btr  1, :-2',
			
			...spin_unlock(0, 2),
		]
	},
	'Thread-1': {
		frame: new Frame,
		cmds: [
			...spin_lock_yld(0, 2),
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			...spin_unlock(0, 2),
		]
	},
});

/* 2. Mutex (pthread style) */
const mutex_lock = (m, tid, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),
	
	...spin_trylock(m.held, t0),
	`btr  ${t0}, slow_${id}`,  	// enter the slow route if HELD occupied
	
	/* The fast */
	...spin_unlock(m.lock, t0),
	`br   end_${id}`,			// return, HELD acquired
	
	/* The slow */
	`lab  slow_${id}`,
	`lod  ${t0}, ${m.queue_tail}`,
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,	// add TID to queue
	`imm  ${t1}, 1`,
	`add  ${t0}, ${t1}`,	// tail + 1
	`sto  ${t0}, ${m.queue_tail}`,
	...spin_unlock(m.lock, t0),
	`blk`,	
	
	`lab  end_${id}`,
	/* Awaken, the HELD is ours now. No need to set HELD, because the
	thread who awoke us didn't unset it. Just continue running. */ ]
};
	
const mutex_unlock = (m, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(m.lock, t0),
	
	`lod  ${t0}, ${m.queue_head}`,
	`lod  ${t1}, ${m.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, empty_${id}`,
	
	/* queue non-empty */
	`imm  ${t1}, 1`, // increment head
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${m.queue_head}`,
	`sub  ${t0}, ${t1}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	...spin_unlock(m.lock, t0),
	`pst  ${t1}`,
	`br   end_${id}`,
	
	/* queue empty */
	`lab  empty_${id}`,
	`imm  ${t0}, 0`,
	`sto  ${t0}, ${m.held}`, // release HELD
	...spin_unlock(m.lock, t0),
	`lab  end_${id}`, ];
};

const mtx = {
	lock: 0,
	held: 1,
	queue_head: 2,
	queue_tail: 3,
};

const run_mutex_lock = new Scheduler(
	{
	'0': {
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 0, 2, 3),
			
			'imm  0, -1',
			'imm  1, 15',
			'add  1, 0',
			'prt  1',
			'btr  1, :-2',
			
			...mutex_unlock(mtx, 2, 3),
			
			`imm  0, -1`,
			`imm  1, 15`,
			`add  1, 0`,
			`prt  1`,
			`btr  1, :-2`,
		]
	},
	'1': {
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 1, 0, 1),
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			...mutex_unlock(mtx, 0, 1),
		]
	},
},
(o) => {
	o.memory[2] = 4;
	o.memory[3] = 4;
});

/* 3. Condition variable (pthread style) */
const cond_wait = (c, m, tid, t0, t1) => [
	...spin_lock_yld(c.lock, t0),
	
	`lod  ${t0}, ${c.queue_tail}`,   // queue.add(self)
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,
	`imm  ${t1}, 1`,
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${c.queue_tail}`,
	
	...spin_unlock(c.lock, t0),
	...mutex_unlock(m, t0, t1),
	
	`blk`,         // block self
	
	...mutex_lock(m, 0, 0, 1),
];

const cond_signal = (c, t0, t1) => {
	const id = Math.round(Math.random() * 1000000);
	return [
	...spin_lock_yld(c.lock, t0),
	
	`lod  ${t0}, ${c.queue_head}`,
	`lod  ${t1}, ${c.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, empty_${id}`,
	
	`imm  ${t1}, 1`, // increment head
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${c.queue_head}`,
	`sub  ${t0}, ${t1}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	...spin_unlock(c.lock, t0),
	`pst  ${t1}`,
	`br   end_${id}`,
	
	`lab  empty_${id}`,
	...spin_unlock(c.lock, t0),
	
	`lab  end_${id}`,
	];
};

const cond = {
	lock: 4,
	queue_head: 5,
	queue_tail: 6,
};

const run_cond_var = new Scheduler({
	'0': {  // waiter
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 0, 0, 1),
			
			'lab  check',
			'lod  0, 49',  // CRITICAL STARTS using mem[49] as required condition
			'btr  0, success',
			
			...cond_wait(cond, mtx, 0, 0, 1),
			
			'br   check',  // CRITICAL ENDS
			'lab  success',
			
			...mutex_unlock(mtx, 0, 1),
		],
		
	},
	'1': {  // poster
		frame: new Frame,
		cmds: [
			...mutex_lock(mtx, 1, 0, 1),
			
			// Write mem[49] = 1, to satisfy the condition
			'imm  0, 1',
			'sto  0, 49',
			
			...cond_signal(cond, 0, 1),

			...mutex_unlock(mtx, 0, 1),
		],
	},
}, (o) => {
	// mutex's queue starts from mem[10]
	o.memory[2] = 10;
	o.memory[3] = 10;
	
	// cond's queue starts from mem[20]
	o.memory[5] = 20;
	o.memory[6] = 20;
});

// run_spin_lock.loop();
// run_spin_lock_with_yld.loop();
// run_mutex_lock.loop();
run_cond_var.loop();
