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


test('more difficult case', async t => {
	const conf = new Map()
	conf.set([Horse, Turtle, Lion, Monkey, Snake], 6)
	const votes = constuctVotes(conf)
	const results = WrightSTV(3, votes, CANDIDATES)
	t.deepEqual(results, [Horse, Turtle, Lion])
})
