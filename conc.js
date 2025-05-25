const MEM_SIZE = 50, REG_SIZE = 5, SLICE = 30;

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
		action(this);
	}
	
	#execute(cmd) {
		/* Available instructions:
		 * imm reg, imm
		 * lod reg, mem
		 * sto reg, mem
		 * ldr reg, mem[reg]
		 * str reg, mem[reg]
		 * br pos
		 * btr reg, pos
		 * bfs reg, pos
		 */
		const [op, sa, sb] = cmd.split(/\s*,?\s+/, 3);
		const [a, b] = [sa, sb].map(s => parseInt(s));
		// console.log(`${op}\t${a}, ${b}`);
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
			this.frame.pc = a
			break;
		case 'btr':
			if (this.frame.regs[a]) this.frame.pc = b;
			else this.frame.pc++;
			break;
		case 'bfs':
			if (!this.frame.regs[a]) this.frame.pc = b;
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
				// console.log(`\x1B[34mSlice=${SLICE} for thread ${tid}\x1B[0m`);
				const thread = this.ready[tid];
				this.frame = thread.frame;
				for (let j = 0; j < SLICE; j++) {
					// The thread is over:
					if (this.frame.pc >= thread.cmds.length) {
						delete this.ready[tid];
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
			}
		}
	}
}


/* 1. Spin-Lock
spin_trylock(lock):
	cas  t0, lock  # result in `t0`

spin_lock(lock):
	cas  t0, lock
	btr  t0, :-1

spin_unlock(lock)
	imm  t0, 0
	sto  t0, lock
*/
const spin_lock = new Scheduler({
	'Thread-0': {
		frame: new Frame,
		cmds: [
			'cas  4, 4',  // check the lock
			'btr  4, 0',  // loop back if lock occupied
			
			'imm  0, 123',
			'sto  0, 0',
			'lod  0, 0',
			'prt  0',
			
			'sto  3, 4',  // release the lock
		]
	},
	'Thread-1': {
		frame: new Frame,
		cmds: [
			'cas  4, 4',
			'btr  4, 0',
	
			'imm  0, 456',
			'sto  0, 0',
		
			'sto  3, 4',
		]
	},
}, o=>{});

const spin_lock_with_yld = new Scheduler({
	'Thread-0': {
		frame: new Frame,
		cmds: [
			'cas  4, 4',  // check the lock
			'bfs  4, 4',  // go in if lock acquired
			'yld',		// else yld, and try again next time
			'br   0',
			/* We may also yld only after a few spins; just spinning
			   for ONE time here. */
			
			// occupy the lock:
			'imm  0, -1',
			'imm  1, 50',
			'add  1, 0',
			'prt  1',
			'btr  1, 6',
			
			'sto  3, 4',  // release the lock
		]
	},
	'Thread-1': {
		frame: new Frame,
		cmds: [
			'cas  4, 4',  // check the lock
			'bfs  4, 4',  // go in if lock acquired
			'yld',		// else yld, and try again next time
			'br   0',
			
			'imm  0, 123', // prt '123'
			'prt  0',
			
			'sto  3, 4',
		]
	},
}, o=>{});

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
const mutex_lock = new Scheduler(
	{
	'0': {
		frame: new Frame,
		cmds: [
			// mtx_lock
			// We use mem[0], mem[1] as held & lock
			'cas  0, 1',  // acquire the mutex's LOCK
			'btr  0, 0',
			
			'cas  0, 0',  // check the HELD
			'btr  0, 6',  // enter the slow route on HELD occupied
			
			'sto  0, 1',  // release the LOCK
			'br   15',    // return, HELD acquired
			
			// Assume that the queue data structure:
			// - mem[2]: head of queue
			// - mem[3]: tail of queue
			// locked up by LOCK.
			'imm  0, 0', // TID
			'lod  1, 3', // tail
			'str  0, 1', // add TID to queue
			'imm  0, 1',
			'add  0, 1', // tail + 1
			'sto  0, 3', // update mem[3]
			
			'imm  0, 0',
			'sto  0, 1',  // release the mutex's LOCK
			
			'blk',	
			/* Awaken, the HELD is ours now. No need to set HELD, because the
			awoker didn't unset it. Just continue running. */
			
			// occupy the lock:
			'imm  0, -1',
			'imm  1, 15',
			'add  1, 0',
			'prt  1',
			'btr  1, 17',
			
			// mtx_unlock
			'cas  0, 1',  // acquire the mutex's LOCK
			'btr  0, 20',
			
			'lod  0, 2',  // queue head
			'lod  1, 3',  // queue tail
			'sub  1, 0',
			'bfs  1, 34',
			
			'ldr  1, 0',  // first TID in queue
			'imm  2, 1',  // increment head
			'add  0, 2',
			'sto  0, 2',
			'imm  0, 0',
			'sto  0, 1',  // release the mutex's LOCK
			'pst  1',
			'br   37',
			
			'imm  0, 0',  // release HELD
			"sto  0, 0",
			'sto  0, 1',  // release the mutex's LOCK
			
			'imm  0, -1',
			'imm  1, 30',
			'add  1, 0',
			'prt  1',
			'btr  1, 39',
		]
	},
	'1': {
		frame: new Frame,
		cmds: [
			// mtx_lock
			// We use mem[0], mem[1] as held & lock
			'cas  0, 1',  // acquire the mutex's LOCK
			'btr  0, 0',
			
			'cas  0, 0',  // check the HELD
			'btr  0, 6',  // enter the slow route on HELD occupied
			
			'sto  0, 1',  // release the LOCK
			'br   15',    // return, HELD acquired
			
			// Assume that the queue data structure:
			// - mem[2]: head of queue
			// - mem[3]: tail of queue
			// locked up by LOCK.
			'imm  0, 1', // TID
			'lod  1, 3', // tail
			'str  0, 1', // add TID to queue
			'imm  0, 1',
			'add  0, 1', // tail + 1
			'sto  0, 3', // update mem[3]
			
			'imm  0, 0',
			'sto  0, 1',  // release the mutex's LOCK
			
			'blk',	
			
			// Print a flag
			'imm  0, 123', // prt '123'
			'prt  0',
			
			// mtx_unlock
			'cas  0, 1',  // acquire the mutex's LOCK
			'btr  0, 17',
			
			'lod  0, 2',  // queue head
			'lod  1, 3',  // queue tail
			'sub  1, 0',
			'bfs  1, 31',
			
			'ldr  1, 0',  // first TID in queue
			'imm  2, 1',  // increment head
			'add  0, 2',
			'sto  0, 2',
			'imm  0, 0',
			'sto  0, 1',  // release the mutex's LOCK
			'pst  1',
			'br   34',
			
			'imm  0, 0',  // release HELD
			"sto  0, 0",
			'sto  0, 1',  // release the mutex's LOCK
		]
	},
},
(o) => {
	o.memory[2] = 4;
	o.memory[3] = 4;
});

// spin_lock.loop();
// spin_lock_with_yld.loop();
mutex_lock.loop();
