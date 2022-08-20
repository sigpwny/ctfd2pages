// Compile with:
// $ emcc fuzzysearch_native.c -sEXPORTED_FUNCTIONS=_fuzzysearch,_malloc -sEXPORTED_RUNTIME_METHODS=ccall,getValue -sALLOW_MEMORY_GROWTH=1 -sNODEJS_CATCH_REJECTION=0 -sNODEJS_CATCH_EXIT=0 -O2 -o fuzzysearch_native.js

#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <emscripten.h>

#define PATH_ADD 0
#define PATH_DEL 1
#define PATH_CHG 2

// Algorithm from: https://en.wikipedia.org/wiki/Approximate_string_matching#Problem_formulation_and_algorithms
// Modified code from https://en.wikibooks.org/wiki/Algorithm_Implementation/Strings/Levenshtein_distance#C
void fuzzysearch(char *s1, char *s2, uint32_t *start, uint32_t *end)
{
	uint32_t s1len = strlen(s1);
	uint32_t s2len = strlen(s2);
	uint32_t x, y;
	uint32_t lend, min;

	uint32_t *pmatDist = calloc(sizeof(*pmatDist), (s2len+1)*(s1len+1));
	uint32_t (*matDist)[s1len+1] = (void *)pmatDist;

	char *pmatPath = calloc(sizeof(*pmatPath), (s2len+1)*(s1len+1));
	char (*matPath)[s1len+1] = (void *)pmatPath;

	for (x = 1; x <= s2len; x++)
		matDist[x][0] = x;
	for (y = 1; y <= s1len; y++)
		matDist[0][y] = 0;
	for (x = 1; x <= s2len; x++)
		for (y = 1; y <= s1len; y++) {
			uint32_t add = matDist[x-1][y] + 1;
			uint32_t del = matDist[x][y-1] + 1;
			uint32_t chg = matDist[x-1][y-1] + (s1[y-1] == s2[x-1] ? 0 : 1);

			if (add <= del && add <= chg) {
				matDist[x][y] = add;
				matPath[x][y] = PATH_ADD;
			} else if (del <= add && del <= chg) {
				matDist[x][y] = del;
				matPath[x][y] = PATH_DEL;
			} else if (chg <= add && chg <= del) {
				matDist[x][y] = chg;
				matPath[x][y] = PATH_CHG;
			} else {
				assert(false);
			}
		}

	min = matDist[s2len][0];
	for (y = 0; y <= s1len; y++) {
		if (matDist[s2len][y] < min) {
			lend = y;
			min = matDist[s2len][y];
		}
	}

	x = s2len;
	y = lend;
	while (x) {
		switch (matPath[x][y]) {
		case PATH_ADD:
			x--;
			break;
		case PATH_DEL:
			y--;
			break;
		case PATH_CHG:
			x--;
			y--;
			break;
		}
	}

	*start = y;
	*end = lend;

	free(pmatDist);
	free(pmatPath);
}
