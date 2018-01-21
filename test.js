import test from 'ava'
import { WrightSTV, Candidate, Vote } from './index'


const Horse = new Candidate('Horse')
const Turtle = new Candidate('Turtle')
const Lion = new Candidate('Lion')
const Monkey = new Candidate('Monkey')
const Snake = new Candidate('Snake')

const CANDIDATES = [Horse, Turtle, Lion, Monkey, Snake]


function constuctVotes(mapping) {
	const votes = []
	for (let [prefs, count] of mapping.entries()) {
		for (let i = 0; i < count; i++) {
			votes.push(new Vote(prefs))
		}
	}
	return votes
}


test('simple case', async t => {
	const conf = new Map()
	conf.set([Horse, Turtle, Lion, Monkey, Snake], 12)
	const votes = constuctVotes(conf)
	const results = WrightSTV(3, votes, CANDIDATES)
	t.deepEqual(results, [Horse, Turtle, Lion])
})


test('a slightly less simple case', async t => {
	const conf = new Map()
	conf.set([Horse], 6)
	conf.set([Lion], 6)
	const votes = constuctVotes(conf)
	const results = WrightSTV(2, votes, CANDIDATES)
	t.deepEqual(results, [Horse, Lion])
})


test('now we\'re really testing the alogirthm', async t => {
	const conf = new Map()
	conf.set([Horse, Turtle, Lion, Monkey, Snake], 20)
	conf.set([Turtle, Horse, Lion, Monkey, Snake], 25)
	conf.set([Lion, Monkey, Snake, Turtle, Horse], 16)
	conf.set([Snake, Lion, Turtle, Monkey, Horse], 40)
	const votes = constuctVotes(conf)
	const results = WrightSTV(3, votes, CANDIDATES)
	t.deepEqual(results, [Snake, Lion, Turtle])
})
