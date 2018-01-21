"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Fraction = require('fraction.js');
function WrightSTV(numVacancies, votes, candidates) {
    const quota = calculateDroopQuota(numVacancies, votes.length);
    return determineWinnersIteratively(numVacancies, quota, votes, candidates);
}
exports.WrightSTV = WrightSTV;
function calculateDroopQuota(numVacancies, numVotes) {
    return Fraction(numVotes).div(1 + numVacancies).add(1).floor();
}
exports.calculateDroopQuota = calculateDroopQuota;
function calculateHareQuota(numVacancies, numVotes) {
    return Fraction(numVotes).div(numVacancies).floor();
}
exports.calculateHareQuota = calculateHareQuota;
class Candidate {
    constructor(name) {
        this.name = name;
    }
    static filterCandidateFromList(candidates, candidateToRemove) {
        return candidates.filter(c => c !== candidateToRemove);
    }
}
exports.Candidate = Candidate;
class Vote {
    constructor(prefs) {
        this.prefs = Array.from(new Set(prefs));
    }
}
exports.Vote = Vote;
class RoundVote {
    constructor(vote) {
        this.vote = vote;
        this.value = Fraction(1);
    }
    mostPreferred(candidates) {
        const prefCandidate = this.vote.prefs.find(c => candidates.includes(c));
        if (!prefCandidate) {
            throw new Error('exhausted vote, no mostPreferred amongst candidates');
        }
        return prefCandidate;
    }
    updateValueWithSurplusRatio(surplusRatio) {
        this.value = this.value.mul(surplusRatio);
    }
    static fromVotes(votes) {
        return votes.map(v => new RoundVote(v));
    }
}
exports.RoundVote = RoundVote;
class CandidateResult {
    constructor(candidate) {
        this.candidate = candidate;
        this.cachedRoundVotes = [];
        this.cachedValue = Fraction(0);
    }
    saveRoundVote(roundVote) {
        this.cachedValue = this.cachedValue.add(roundVote.value);
        this.cachedRoundVotes.push(roundVote);
    }
    isWinner(quota) {
        return this.cachedValue.compare(quota) >= 0;
    }
    isVoteSurplus(quota) {
        return this.cachedValue.compare(quota) > 0;
    }
    declareVoteSurplus(quota) {
        if (this.cachedValue.compare(quota) <= 0) {
            throw new Error();
        }
        const surplusRatio = this.calculateSurplusRatio(quota);
        this.cachedRoundVotes.forEach(rv => rv.updateValueWithSurplusRatio(surplusRatio));
        this.cachedValue = quota;
        return this.cachedRoundVotes;
    }
    calculateSurplusRatio(quota) {
        if (this.cachedValue.compare(quota) <= 0) {
            throw new Error();
        }
        return this.cachedValue.sub(quota).div(this.cachedValue);
    }
    static sortHighest(a, b) {
        const byValue = b.cachedValue.sub(a.cachedValue);
        if (byValue.compare(0) === 0) {
            const byNumVotes = a.cachedRoundVotes.length - b.cachedRoundVotes.length;
            if (byNumVotes === 0) {
                // not sure how to handle this scenario...
                return 0;
            }
            return byNumVotes;
        }
        return byValue;
    }
}
exports.CandidateResult = CandidateResult;
class ResultMap extends Map {
    static fromCandidates(candidates) {
        const resultMap = new ResultMap();
        candidates.forEach(c => resultMap.set(c, new CandidateResult(c)));
        return resultMap;
    }
    saveRoundVotes(roundVotes, validCandidates) {
        roundVotes.forEach(roundVote => {
            try {
                const prefCandidate = roundVote.mostPreferred(validCandidates);
                const prefCandidateResult = this.get(prefCandidate);
                prefCandidateResult.saveRoundVote(roundVote);
            }
            catch (e) {
                // ignore exhausted votes
            }
        });
    }
    getSortedResults() {
        return Array.from(this.values()).sort(CandidateResult.sortHighest);
    }
}
exports.ResultMap = ResultMap;
function determineWinnersIteratively(numVacancies, quota, legalVotes, candidates) {
    if (candidates.length < numVacancies) {
        throw new Error();
    }
    else if (candidates.length === numVacancies) {
        return candidates;
    }
    const roundVotes = RoundVote.fromVotes(legalVotes);
    const stableResultMap = calculateStableVoteResult(quota, roundVotes, candidates);
    const winningCandidates = determineWinners(quota, stableResultMap);
    if (winningCandidates.length === numVacancies) {
        return winningCandidates;
    }
    const remainingCandidates = filterExcludedCandidate(stableResultMap);
    return determineWinnersIteratively(numVacancies, quota, legalVotes, remainingCandidates);
}
exports.determineWinnersIteratively = determineWinnersIteratively;
function calculateStableVoteResult(quota, roundVotes, candidates, resultMap) {
    if (!resultMap) {
        resultMap = calculateInitialVoteResult(roundVotes, candidates);
    }
    const surplusCandidate = determineSurplusCandidate(quota, resultMap);
    if (surplusCandidate === false) {
        return resultMap;
    }
    const remainingCandidates = Candidate.filterCandidateFromList(candidates, surplusCandidate);
    updateResultWithSurplusVotes(quota, remainingCandidates, resultMap, surplusCandidate);
    return calculateStableVoteResult(quota, roundVotes, remainingCandidates, resultMap);
}
exports.calculateStableVoteResult = calculateStableVoteResult;
function calculateInitialVoteResult(roundVotes, candidates) {
    const resultMap = ResultMap.fromCandidates(candidates);
    resultMap.saveRoundVotes(roundVotes, candidates);
    return resultMap;
}
exports.calculateInitialVoteResult = calculateInitialVoteResult;
function determineSurplusCandidate(quota, resultMap) {
    const sortedResults = resultMap.getSortedResults();
    const highestSurplus = sortedResults.find(result => result.isVoteSurplus(quota));
    return highestSurplus === undefined ? false : highestSurplus.candidate;
}
function updateResultWithSurplusVotes(quota, remainingCandidates, resultMap, surplusCandidate) {
    const candidateResult = resultMap.get(surplusCandidate);
    const surplusVotes = candidateResult.declareVoteSurplus(quota);
    resultMap.saveRoundVotes(surplusVotes, remainingCandidates);
}
exports.updateResultWithSurplusVotes = updateResultWithSurplusVotes;
function determineWinners(quota, stableResultMap) {
    return stableResultMap
        .getSortedResults()
        .filter(result => result.isWinner(quota))
        .map(result => result.candidate);
}
exports.determineWinners = determineWinners;
function filterExcludedCandidate(stableResultMap) {
    return stableResultMap
        .getSortedResults()
        .map(result => result.candidate)
        .reverse()
        .slice(1);
}
exports.filterExcludedCandidate = filterExcludedCandidate;
