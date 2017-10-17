function WrightSTV(numVacancies: number, votes: Vote[], candidates: Candidate[]) {
	const quota = calculateDroopQuota(numVacancies, votes.length)
	return determineWinnersIteratively(numVacancies, quota, votes, candidates)
}

function calculateDroopQuota(numVacancies: number, numVotes: number): number {
	return Math.floor(1 + numVotes / (numVacancies + 1))
}

function calculateHareQuota(numVacancies: number, numVotes: number): number {
	return Math.floor(numVotes / numVacancies)
}


class Candidate {
	constructor(public name: string) {}

	static filterCandidateFromList(
		candidates: Candidate[],
		candidateToRemove: Candidate
	): Candidate[] {
		return candidates.filter(c => c !== candidateToRemove)
	}
}


class Vote {
	public prefs: Candidate[]

	constructor(...prefs: Candidate[]) {
		this.prefs = Array.from(new Set(prefs))
	}
}


class RoundVote {
	public value: number

	constructor(public vote: Vote) {
		this.value = 1
	}

	mostPreferred(candidates: Candidate[]): Candidate {
		return this.vote.prefs.find(c => candidates.includes(c))
	}

	updateValueWithSurplusRatio(surplusRatio: number): void {
		this.value *= surplusRatio
	}

	static fromVotes(votes: Vote[]): RoundVote[] {
		return votes.map(v => new RoundVote(v))
	}
}


class CandidateResult {
	public cachedRoundVotes: RoundVote[]
	public cachedValue: number

	constructor(public candidate: Candidate) {
		this.cachedRoundVotes = []
		this.cachedValue = 0
	}

	saveRoundVote(roundVote: RoundVote): void {
		this.cachedValue += roundVote.value
		this.cachedRoundVotes.push(roundVote)
	}

	isWinner(quota: number): boolean {
		return this.cachedValue >= quota
	}

	isVoteSurplus(quota: number): boolean {
		return this.cachedValue > quota
	}

	declareVoteSurplus(quota: number): RoundVote[] {
		if (this.cachedValue <= quota) {
			throw new Error()
		}
		const surplusRatio = this.calculateSurplusRatio(quota)
		this.cachedRoundVotes.forEach(rv => rv.updateValueWithSurplusRatio(surplusRatio))
		this.cachedValue = quota
		return this.cachedRoundVotes
	}

	calculateSurplusRatio(quota: number): number {
		if (this.cachedValue <= quota) {
			throw new Error()
		}
		return (this.cachedValue - quota) / this.cachedValue
	}

	static sortHighest(a: CandidateResult, b: CandidateResult): number {
		const byValue = a.cachedValue - b.cachedValue
		if (byValue === 0) {
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


class ResultMap extends Map {
	static fromCandidates(candidates: Candidate[]): ResultMap {
		const resultMap = new ResultMap()
		candidates.forEach(c => resultMap.set(c, new CandidateResult(c)))
		return resultMap
	}

	saveRoundVotes(roundVotes: RoundVote[], validCandidates: Candidate[]): void {
		roundVotes.forEach(roundVote => {
			const prefCandidate = roundVote.mostPreferred(validCandidates)
			const prefCandidateResult = this.get(prefCandidate)
			prefCandidateResult.saveRoundVote(roundVote)
		})
	}

	getSortedResults(): CandidateResult[] {
		return Array.from(this.values()).sort(CandidateResult.sortHighest)
	}
}


function determineWinnersIteratively(
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


function calculateStableVoteResult(
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


function calculateInitialVoteResult(roundVotes: RoundVote[], candidates: Candidate[]) {
	const resultMap = ResultMap.fromCandidates(candidates)
	resultMap.saveRoundVotes(roundVotes, candidates)
	return resultMap
}


function determineSurplusCandidate(quota: number, resultMap: ResultMap): Candidate | boolean {
	const sortedResults = resultMap.getSortedResults()
	const highestSurplus = sortedResults.find(result => result.isVoteSurplus(quota))
	return highestSurplus === undefined ? false : highestSurplus.candidate
}


function updateResultWithSurplusVotes(
	quota: number,
	remainingCandidates: Candidate[],
	resultMap: ResultMap,
	surplusCandidate: Candidate
): void {
	const candidateResult = resultMap.get(surplusCandidate)
	const surplusVotes = candidateResult.declareVoteSurplus(quota)
	resultMap.saveRoundVotes(surplusVotes, remainingCandidates)
}


function determineWinners(quota: number, stableResultMap: ResultMap): Candidate[] {
	return stableResultMap
		.getSortedResults()
		.filter(result => result.isWinner(quota))
		.map(result => result.candidate)
}


function filterExcludedCandidate(stableResultMap: ResultMap): Candidate[] {
	return stableResultMap
		.getSortedResults()
		.map(result => result.candidate)
		.reverse()
		.slice(1)
}
