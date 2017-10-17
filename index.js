var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
function WrightSTV(numVacancies, votes, candidates) {
    var quota = calculateDroopQuota(numVacancies, votes.length);
    return determineWinnersIteratively(numVacancies, quota, votes, candidates);
}
function calculateDroopQuota(numVacancies, numVotes) {
    return Math.floor(1 + numVotes / (numVacancies + 1));
}
function calculateHareQuota(numVacancies, numVotes) {
    return Math.floor(numVotes / numVacancies);
}
var Candidate = (function () {
    function Candidate(name) {
        this.name = name;
    }
    Candidate.filterCandidateFromList = function (candidates, candidateToRemove) {
        return candidates.filter(function (c) { return c !== candidateToRemove; });
    };
    return Candidate;
}());
var Vote = (function () {
    function Vote() {
        var prefs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            prefs[_i] = arguments[_i];
        }
        this.prefs = Array.from(new Set(prefs));
    }
    return Vote;
}());
var RoundVote = (function () {
    function RoundVote(vote) {
        this.vote = vote;
        this.value = 1;
    }
    RoundVote.prototype.mostPreferred = function (candidates) {
        return this.vote.prefs.find(function (c) { return candidates.includes(c); });
    };
    RoundVote.prototype.updateValueWithSurplusRatio = function (surplusRatio) {
        this.value *= surplusRatio;
    };
    RoundVote.fromVotes = function (votes) {
        return votes.map(function (v) { return new RoundVote(v); });
    };
    return RoundVote;
}());
var CandidateResult = (function () {
    function CandidateResult(candidate) {
        this.candidate = candidate;
        this.cachedRoundVotes = [];
        this.cachedValue = 0;
    }
    CandidateResult.prototype.saveRoundVote = function (roundVote) {
        this.cachedValue += roundVote.value;
        this.cachedRoundVotes.push(roundVote);
    };
    CandidateResult.prototype.isWinner = function (quota) {
        return this.cachedValue >= quota;
    };
    CandidateResult.prototype.isVoteSurplus = function (quota) {
        return this.cachedValue > quota;
    };
    CandidateResult.prototype.declareVoteSurplus = function (quota) {
        if (this.cachedValue <= quota) {
            throw new Error();
        }
        var surplusRatio = this.calculateSurplusRatio(quota);
        this.cachedRoundVotes.forEach(function (rv) { return rv.updateValueWithSurplusRatio(surplusRatio); });
        this.cachedValue = quota;
        return this.cachedRoundVotes;
    };
    CandidateResult.prototype.calculateSurplusRatio = function (quota) {
        if (this.cachedValue <= quota) {
            throw new Error();
        }
        return (this.cachedValue - quota) / this.cachedValue;
    };
    CandidateResult.sortHighest = function (a, b) {
        var byValue = a.cachedValue - b.cachedValue;
        if (byValue === 0) {
            var byNumVotes = a.cachedRoundVotes.length - b.cachedRoundVotes.length;
            if (byNumVotes === 0) {
                // not sure how to handle this scenario...
                return 0;
            }
            return byNumVotes;
        }
        return byValue;
    };
    return CandidateResult;
}());
var ResultMap = (function (_super) {
    __extends(ResultMap, _super);
    function ResultMap() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ResultMap.fromCandidates = function (candidates) {
        var resultMap = new ResultMap();
        candidates.forEach(function (c) { return resultMap.set(c, new CandidateResult(c)); });
        return resultMap;
    };
    ResultMap.prototype.saveRoundVotes = function (roundVotes, validCandidates) {
        var _this = this;
        roundVotes.forEach(function (roundVote) {
            var prefCandidate = roundVote.mostPreferred(validCandidates);
            var prefCandidateResult = _this.get(prefCandidate);
            prefCandidateResult.saveRoundVote(roundVote);
        });
    };
    ResultMap.prototype.getSortedResults = function () {
        return Array.from(this.values()).sort(CandidateResult.sortHighest);
    };
    return ResultMap;
}(Map));
function determineWinnersIteratively(numVacancies, quota, legalVotes, candidates) {
    if (candidates.length < numVacancies) {
        throw new Error();
    }
    else if (candidates.length === numVacancies) {
        return candidates;
    }
    var roundVotes = RoundVote.fromVotes(legalVotes);
    var stableResultMap = calculateStableVoteResult(quota, roundVotes, candidates);
    var winningCandidates = determineWinners(quota, stableResultMap);
    if (winningCandidates.length === numVacancies) {
        return winningCandidates;
    }
    var remainingCandidates = filterExcludedCandidate(stableResultMap);
    return determineWinnersIteratively(numVacancies, quota, legalVotes, remainingCandidates);
}
function calculateStableVoteResult(quota, roundVotes, candidates, resultMap) {
    if (!resultMap) {
        resultMap = calculateInitialVoteResult(roundVotes, candidates);
    }
    var surplusCandidate = determineSurplusCandidate(quota, resultMap);
    if (surplusCandidate === false) {
        return resultMap;
    }
    var remainingCandidates = Candidate.filterCandidateFromList(candidates, surplusCandidate);
    updateResultWithSurplusVotes(quota, remainingCandidates, resultMap, surplusCandidate);
    return calculateStableVoteResult(quota, roundVotes, remainingCandidates, resultMap);
}
function calculateInitialVoteResult(roundVotes, candidates) {
    var resultMap = ResultMap.fromCandidates(candidates);
    resultMap.saveRoundVotes(roundVotes, candidates);
    return resultMap;
}
function determineSurplusCandidate(quota, resultMap) {
    var sortedResults = resultMap.getSortedResults();
    var highestSurplus = sortedResults.find(function (result) { return result.isVoteSurplus(quota); });
    return highestSurplus === undefined ? false : highestSurplus.candidate;
}
function updateResultWithSurplusVotes(quota, remainingCandidates, resultMap, surplusCandidate) {
    var candidateResult = resultMap.get(surplusCandidate);
    var surplusVotes = candidateResult.declareVoteSurplus(quota);
    resultMap.saveRoundVotes(surplusVotes, remainingCandidates);
}
function determineWinners(quota, stableResultMap) {
    return stableResultMap
        .getSortedResults()
        .filter(function (result) { return result.isWinner(quota); })
        .map(function (result) { return result.candidate; });
}
function filterExcludedCandidate(stableResultMap) {
    return stableResultMap
        .getSortedResults()
        .map(function (result) { return result.candidate; })
        .reverse()
        .slice(1);
}
