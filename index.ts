const Fraction = require('fraction.js')


export function WrightSTV(numVacancies: number, votes: Vote[], candidates: Candidate[]) {
	const quota = calculateDroopQuota(numVacancies, votes.length)
	return determineWinnersIteratively(numVacancies, quota, votes, candidates)
}

export function calculateDroopQuota(numVacancies: number, numVotes: number): number {
	return Fraction(numVotes).div(1 + numVacancies).add(1).floor()
}

export function calculateHareQuota(numVacancies: number, numVotes: number): number {
	return Fraction(numVotes).div(numVacancies).floor()
}


export class Candidate {
	constructor(public name: string) {}

	static filterCandidateFromList(
		candidates: Candidate[],
		candidateToRemove: Candidate
	): Candidate[] {
		return candidates.filter(c => c !== candidateToRemove)
	}
}


export class Vote {
	public prefs: Candidate[]

	constructor(prefs: Candidate[]) {
		this.prefs = Array.from(new Set(prefs))
	}
}


export class RoundVote {
	public value: Fraction

	constructor(public vote: Vote) {
		this.value = Fraction(1)
	}

	mostPreferred(candidates: Candidate[]): Candidate {
		const prefCandidate = this.vote.prefs.find(c => candidates.includes(c))
		if (!prefCandidate) {
			throw new Error('exhausted vote, no mostPreferred amongst candidates')
		}
		return prefCandidate
	}

	updateValueWithSurplusRatio(surplusRatio: Fraction): void {
		this.value = this.value.mul(surplusRatio)
	}

	static fromVotes(votes: Vote[]): RoundVote[] {
		return votes.map(v => new RoundVote(v))
	}
}


export class CandidateResult {
	public cachedRoundVotes: RoundVote[]
	public cachedValue: Fraction

	constructor(public candidate: Candidate) {
		this.cachedRoundVotes = []
		this.cachedValue = Fraction(0)
	}

	saveRoundVote(roundVote: RoundVote): void {
		this.cachedValue = this.cachedValue.add(roundVote.value)
		this.cachedRoundVotes.push(roundVote)
	}

	isWinner(quota: Fraction): boolean {
		return this.cachedValue.compare(quota) >= 0
	}

	isVoteSurplus(quota: number): boolean {
		return this.cachedValue.compare(quota) > 0
	}

	declareVoteSurplus(quota: Fraction): RoundVote[] {
		if (this.cachedValue.compare(quota) <= 0) {
			throw new Error()
		}
		const surplusRatio = this.calculateSurplusRatio(quota)
		this.cachedRoundVotes.forEach(rv => rv.updateValueWithSurplusRatio(surplusRatio))
		this.cachedValue = quota
		return this.cachedRoundVotes
	}

	calculateSurplusRatio(quota: number): number {
		if (this.cachedValue.compare(quota) <= 0) {
			throw new Error()
		}
		return this.cachedValue.sub(quota).div(this.cachedValue)
	}

	static sortHighest(a: CandidateResult, b: CandidateResult): number {
		const byValue = b.cachedValue.sub(a.cachedValue)
		if (byValue.compare(0) === 0) {
			const byNumVotes = a.cachedRoundVotes.length - b.cachedRoundVotes.length
			if (byNumVotes === 0) {
				// not sure how to handle this scenario...
				return 0
			}
			return byNumVotes
		}
		return byValue
	}
}


export class ResultMap extends Map {
	static fromCandidates(candidates: Candidate[]): ResultMap {
		const resultMap = new ResultMap()
		candidates.forEach(c => resultMap.set(c, new CandidateResult(c)))
		return resultMap
	}

	saveRoundVotes(roundVotes: RoundVote[], validCandidates: Candidate[]): void {
		roundVotes.forEach(roundVote => {
			try {
				const prefCandidate = roundVote.mostPreferred(validCandidates)
				const prefCandidateResult = this.get(prefCandidate)
				prefCandidateResult.saveRoundVote(roundVote)
			} catch (e) {
				// ignore exhausted votes
			}
		})
	}

	getSortedResults(): CandidateResult[] {
		return Array.from(this.values()).sort(CandidateResult.sortHighest)
	}
}


export function determineWinnersIteratively(
	numVacancies: number,
	quota: number,
	legalVotes: Vote[],
	candidates: Candidate[]
): Candidate[] {
	if (candidates.length < numVacancies) {
		throw new Error()
	} else if (candidates.length === numVacancies) {
		return candidates
	}
	const roundVotes = RoundVote.fromVotes(legalVotes)
	const stableResultMap = calculateStableVoteResult(quota, roundVotes, candidates)
	const winningCandidates = determineWinners(quota, stableResultMap)
	if (winningCandidates.length === numVacancies) {
		return winningCandidates
	}
	const remainingCandidates = filterExcludedCandidate(stableResultMap)
	return determineWinnersIteratively(numVacancies, quota, legalVotes, remainingCandidates)
}


export function calculateStableVoteResult(
	quota: number,
	roundVotes: RoundVote[],
	candidates: Candidate[],
	resultMap?: ResultMap
): ResultMap {
	if (!resultMap) {
		resultMap = calculateInitialVoteResult(roundVotes, candidates)
	}
	const surplusCandidate = determineSurplusCandidate(quota, resultMap)
	if (surplusCandidate === false) {
		return resultMap
	}
	const remainingCandidates = Candidate.filterCandidateFromList(candidates, surplusCandidate)
	updateResultWithSurplusVotes(quota, remainingCandidates, resultMap, surplusCandidate)
	return calculateStableVoteResult(quota, roundVotes, remainingCandidates, resultMap)
}


export function calculateInitialVoteResult(roundVotes: RoundVote[], candidates: Candidate[]) {
	const resultMap = ResultMap.fromCandidates(candidates)
	resultMap.saveRoundVotes(roundVotes, candidates)
	return resultMap
}


function determineSurplusCandidate(quota: number, resultMap: ResultMap): Candidate | boolean {
	const sortedResults = resultMap.getSortedResults()
	const highestSurplus = sortedResults.find(result => result.isVoteSurplus(quota))
	return highestSurplus === undefined ? false : highestSurplus.candidate
}


export function updateResultWithSurplusVotes(
	quota: number,
	remainingCandidates: Candidate[],
	resultMap: ResultMap,
	surplusCandidate: Candidate
): void {
	const candidateResult = resultMap.get(surplusCandidate)
	const surplusVotes = candidateResult.declareVoteSurplus(quota)
	resultMap.saveRoundVotes(surplusVotes, remainingCandidates)
}


export function determineWinners(quota: number, stableResultMap: ResultMap): Candidate[] {
	return stableResultMap
		.getSortedResults()
		.filter(result => result.isWinner(quota))
		.map(result => result.candidate)
}


export function filterExcludedCandidate(stableResultMap: ResultMap): Candidate[] {
	return stableResultMap
		.getSortedResults()
		.map(result => result.candidate)
		.reverse()
		.slice(1)
}
