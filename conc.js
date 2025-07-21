const MEM_SIZE = 50, REG_SIZE = 5, SLICE = 20;

class Frame {
	pc = 0;
	regs = new Array(REG_SIZE).fill(0);
}
	
class Scheduler {
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
	}
	
	#execute(cmd) {
		const goto = (addr) => {
			if (addr[0] === ':') {
				const target = parseInt(addr.slice(1));
				this.frame.pc += target;
			} else {
				this.frame.pc = parseInt(addr);
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

/* 2. Mutex (pthread style)
mtx_trylock(m):
	return spin_trylock(m.held);
	
mtx_lock(m):
	spin_lock(m.lock);
	if (spin_trylock(m.held) == 0) {
		spin_unlock(m.lock);
	} else {
		m.queue.add(self)
		spin_unlock(m.lock);
		block(self);
	}
	
mtx_unlock(m):
	spin_lock(m.lock);
	if (m.queue.length > 0) {
		t = m.queue.remove(0);
		spin_unlock(m.lock);
		post(t);
	} else {
		m.held = 0;
		spin_unlock(m.lock);
	}

 */
const mutex_lock = (m, tid, t0, t1) => [
	...spin_lock_yld(m.lock, t0),
	
	...spin_trylock(m.held, t0),
	`btr  ${t0}, :+4`,  	// enter the slow route if HELD occupied
	
	/* The fast */
	...spin_unlock(m.lock, t0),
	`br   :+10`,			// return, HELD acquired
	
	/* The slow */
	`lod  ${t0}, ${m.queue_tail}`,
	`imm  ${t1}, ${tid}`,
	`str  ${t1}, ${t0}`,	// add TID to queue
	`imm  ${t1}, 1`,
	`add  ${t0}, ${t1}`,	// tail + 1
	`sto  ${t0}, ${m.queue_tail}`,
	...spin_unlock(m.lock, t0),
	`blk`,	
	
	/* Awaken, the HELD is ours now. No need to set HELD, because the
	thread who awoke us didn't unset it. Just continue running. */ ];
	
const mutex_unlock = (m, t0, t1) => [
	...spin_lock_yld(m.lock, t0),
	
	`lod  ${t0}, ${m.queue_head}`,
	`lod  ${t1}, ${m.queue_tail}`,
	`sub  ${t1}, ${t0}`,
	`bfs  ${t1}, :+10`,
	
	/* queue non-empty */
	`imm  ${t1}, 1`, // increment head
	`add  ${t0}, ${t1}`,
	`sto  ${t0}, ${m.queue_head}`,
	`sub  ${t0}, ${t1}`,
	`ldr  ${t1}, ${t0}`, // first TID in queue
	...spin_unlock(m.lock, t0),
	`pst  ${t1}`,
	`br   :+5`,
	
	/* queue empty */
	`imm  ${t0}, 0`,
	`sto  ${t0}, ${m.held}`, // release HELD
	...spin_unlock(m.lock, t0),
]

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

/* 3. Condition variable (pthread style)

def cond_wait(c: Cond, m: Mutex):
	spin_lock(c.lock)
	c.queue.add(self)
	spin_unlock(c.lock)
	mtx_unlock(m)
	block()
	mtx_lock(m)

def cond_signal(c: Cond):
	spin_lock(c.lock)
	if len(c.lock) > 0:
		t = c.lock.dequeue()
		spin_unlock(c.lock)
		post(t)
	else:
		spin_unlock(c.lock)

*/
const cond_var = new Scheduler({
	'0': {  // waiter
		frame: new Frame,
		cmds: [
			'cas  0, 1',  // mtx_lock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'cas  0, 0',  // acquire HELD
			'btr  0, :3',
			'sto  0, 1',  // release LOCK
			'br   :10',	  // END with fast route
			'imm  0, 0',  // TID, slow route, add self to queue
			'lod  1, 3',
			'str  0, 1',
			'imm  0, 1',
			'add  0, 1',
			'sto  0, 3',
			'imm  0, 0',
			'sto  0, 1',  // release LOCK
			'blk',		   // END OF mtx_lock, block self
			
			'lod  0, 49',  // CRITICAL STARTS using mem[49] as required condition
			'btr  0, :51',
			
			'cas  0, 4',   // cond_wait, spin_lock
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'lod  0, 6',   // queue.add(self)
			'imm  1, 0',   // TID
			'str  1, 0',
			'imm  1, 1',
			'add  0, 1',
			'sto  0, 6',
			'imm  0, 0',   // spin_unlock
			'sto  0, 4',
			'cas  0, 1',   // mtx_unlock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'lod  0, 2',   // HEAD
			'lod  1, 3',   // TAIL
			'sub  1, 0',   // length of queue
			'bfs  1, :9',
			'ldr  1, 0',   // pop from queue
			'imm  2, 1',
			'add  0, 2',
			'sto  0, 2',
			'imm  0, 0',
			'sto  0, 1',   // release LOCK
			'pst  1',      // post waiter
			'br   :4',     // END if waiters exist
			'imm  0, 0',   // if no waiter:
			'sto  0, 0',   // release HELD
			'sto  0, 1',   // END OF mtx_unlock, release LOCK
			
			'blk',         // block self
			
			'cas  0, 1',   // mtx_lock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'cas  0, 0',  // acquire HELD
			'btr  0, :3',
			'sto  0, 1',  // release LOCK
			'br   :10',	  // END with fast route
			'imm  0, 0',  // TID, slow route, add self to queue
			'lod  1, 3',
			'str  0, 1',
			'imm  0, 1',
			'add  0, 1',
			'sto  0, 3',
			'imm  0, 0',
			'sto  0, 1',   // release LOCK
			'blk',		   // END OF cond_wait, END OF mtx_lock, block self
			
			'br   :-51',  // CRITICAL ENDS
			
			'cas  0, 1',   // mtx_unlock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'lod  0, 2',   // HEAD
			'lod  1, 3',   // TAIL
			'sub  1, 0',   // length of queue
			'bfs  1, :9',
			'ldr  1, 0',   // pop from queue
			'imm  2, 1',
			'add  0, 2',
			'sto  0, 2',
			'imm  0, 0',
			'sto  0, 1',   // release LOCK
			'pst  1',      // post waiter
			'br   :4',     // END if waiters exist
			'imm  0, 0',   // if no waiter:
			'sto  0, 0',   // release HELD
			'sto  0, 1',   // END OF mtx_unlock, release LOCK
		],
		
	},
	'1': {  // poster
		frame: new Frame,
		cmds: [
			'cas  0, 1',   // mtx_lock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'cas  0, 0',  // acquire HELD
			'btr  0, :3',
			'sto  0, 1',  // release LOCK
			'br   :10',	  // END with fast route
			'imm  0, 1',  // TID, slow route, add self to queue
			'lod  1, 3',
			'str  0, 1',
			'imm  0, 1',
			'add  0, 1',
			'sto  0, 3',
			'imm  0, 0',
			'sto  0, 1',   // release LOCK
			'blk',		   // END OF cond_wait, END OF mtx_lock, block self
			
			// Write mem[49] = 1, to satisfy the condition
			'imm  0, 1',
			'sto  0, 49',
			
			// Signal the waiter thread:
			// def cond_signal(c: Cond):
			// 	spin_lock(c.lock)
			'cas  0, 4',
			'bfs  0, :3',
			'yld',
			'br   :-3',
			// 	if len(c.lock) > 0:
			'lod  0, 5',
			'lod  1, 6',
			'sub  1, 0',
			'bfs  1, :9',
			// 		t = c.lock.dequeue()
			'ldr  1, 0',
			'imm  2, 1',
			'add  0, 2',
			'sto  0, 5',
			// 		spin_unlock(c.lock)
			'imm  0, 0',
			'sto  0, 4',
			// 		post(t)
			'pst  1',
			'br   :3',
			// 	else:
			// 		spin_unlock(c.lock)
			'imm  0, 0',
			'sto  0, 4',

			'cas  0, 1',   // mtx_unlock, acquire LOCK
			'bfs  0, :3',
			'yld',
			'br   :-3',
			'lod  0, 2',   // HEAD
			'lod  1, 3',   // TAIL
			'sub  1, 0',   // length of queue
			'bfs  1, :9',
			'ldr  1, 0',   // pop from queue
			'imm  2, 1',
			'add  0, 2',
			'sto  0, 2',
			'imm  0, 0',
			'sto  0, 1',   // release LOCK
			'pst  1',      // post waiter
			'br   :4',     // END if waiters exist
			'imm  0, 0',   // if no waiter:
			'sto  0, 0',   // release HELD
			'sto  0, 1',   // END OF mtx_unlock, release LOCK
		],
	},
}, (o) => {
	// m.held: mem[0]
	// m.lock: mem[1]
	// m.queue_head: mem[2]
	// m.queue_tail: mem[3]
	// mutex queue starts from mem[10]
	o.memory[2] = 10;
	o.memory[3] = 10;
	
	// c.lock: mem[4]
	// c.queue_head: mem[5]
	// c.queue_tail: mem[6]
	// condition variable queue starts from mem[20]
	o.memory[5] = 20;
	o.memory[6] = 20;
});

// run_spin_lock.loop();
// run_spin_lock_with_yld.loop();
run_mutex_lock.loop();
// cond_var.loop();
