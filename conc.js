export {
	Frame, Scheduler,
}

class Frame {
	pc = 0;
	regs;
	
	constructor(REG_SIZE) {
		this.regs = new Array(REG_SIZE).fill(0);
	}
}
	
class Scheduler {
	running = null;
	memory; // shared user memory
	frame;  // current frame
	ready; blocked; pstmsg;
	
	constructor(threads, action, SLICE=20, MEM_SIZE=50, REG_SIZE=5) {
		this.MEM_SIZE = MEM_SIZE;
		this.REG_SIZE = REG_SIZE;
		this.SLICE = SLICE;
		
		this.memory = new Array(this.MEM_SIZE).fill(0);  // shared user-space memory
		this.frame = new Frame(this.REG_SIZE);  // the frame currently in use
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
				for (; j < this.SLICE; j++) {
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
