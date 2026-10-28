/**
 * Regression (review round 2): BACKEND_CODING_PROBLEMS mapped local challenges 1..3 to seeded CodingProblems that
 * grade a different function, so students saw one exercise and were graded (and on submit recorded) on another.
 * Each mapped challenge must show exactly the problem lms-api grades: same function, statement, starter code,
 * tests and language. Problems come from lms-api/internal/storage/postgres/seed.go, where they are created in
 * declaration order (ids 1, 2, 3 on a fresh database; pinned by TestCodingLab_SeededProblemIdsAndLanguageIsEnforced).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BACKEND_CODING_PROBLEMS, codingLanguagesFor, lmsApi } from "..";
import { MOCK_CODING_CHALLENGES } from "../mockData";
import { installLocalStorage, mockFetch } from "./testUtils";

const SEED_GO = path.resolve(
  __dirname,
  "../../../../lms-api/internal/storage/postgres/seed.go",
);

interface SeedTest {
  name: string;
  input: string;
  expected: string;
}

interface SeedProblem {
  Title: string;
  Description: string;
  Difficulty: string;
  Language: string;
  FunctionName: string;
  StarterCode: string;
  SolutionHint: string;
  PublicTestsJSON: string;
  HiddenTestsJSON: string;
}

/** CodingProblem literals of seed.go in declaration order, with string fields decoded. */
const seededProblems = (): SeedProblem[] => {
  const src = fs.readFileSync(SEED_GO, "utf8");
  const blocks = [
    ...src.matchAll(/:= entity\.CodingProblem\{\n([\s\S]*?)\n\t\}\n/g),
  ].map((m) => m[1]);
  return blocks.map((body) => {
    const fields: Record<string, string> = {};
    for (const m of body.matchAll(/^\t\t(\w+):\s+"((?:[^"\\]|\\.)*)",$/gm))
      fields[m[1]] = JSON.parse(`"${m[2]}"`);
    for (const m of body.matchAll(/^\t\t(\w+):\s+`([^`]*)`,$/gm))
      fields[m[1]] = m[2];
    return fields as unknown as SeedProblem;
  });
};

describe("Coding Lab challenges match the lms-api problems that grade them", () => {
  const problems = seededProblems();

  it("parses the seeded problems", () => {
    expect(problems.length).toBeGreaterThanOrEqual(3);
    for (const p of problems) {
      expect(p.FunctionName).toBeTruthy();
      expect(p.StarterCode).toBeTruthy();
    }
  });

  it.each(Object.entries(BACKEND_CODING_PROBLEMS))(
    "challenge %s",
    (challengeId, backend) => {
      const problem = problems[backend.problemId - 1];
      expect(
        problem,
        `seed.go has no CodingProblem #${backend.problemId}`,
      ).toBeDefined();
      const challenge = MOCK_CODING_CHALLENGES.find(
        (c) => c.id === Number(challengeId),
      );
      expect(challenge).toBeDefined();
      if (!challenge || !problem) return;

      // Function name and language parity.
      expect(backend.functionName).toBe(problem.FunctionName);
      expect(backend.language).toBe(problem.Language);
      expect(challenge.starterCode.python).toContain(
        `def ${problem.FunctionName}(`,
      );
      expect(challenge.problemStatement).toContain(problem.FunctionName);

      // Same exercise content.
      expect(challenge.title).toBe(problem.Title);
      expect(challenge.difficulty).toBe(problem.Difficulty);
      expect(challenge.problemStatement).toBe(problem.Description);
      expect(challenge.starterCode.python).toBe(problem.StarterCode);
      expect(challenge.aiHint).toBe(problem.SolutionHint);

      // The test list shown before running is the one lms-api runs (public first, then hidden on submit).
      const seedTests = [
        ...(JSON.parse(problem.PublicTestsJSON) as SeedTest[]).map((t) => ({
          ...t,
          isPublic: true,
        })),
        ...(JSON.parse(problem.HiddenTestsJSON) as SeedTest[]).map((t) => ({
          ...t,
          isPublic: false,
        })),
      ];
      expect(
        challenge.testCases.map((t) => ({
          name: t.name,
          input: t.input,
          expected: t.expectedOutput,
          isPublic: t.isPublic,
        })),
      ).toEqual(seedTests);

      // Only the graded language is offered or shipped.
      expect(codingLanguagesFor(challenge)).toEqual([problem.Language]);
      expect(challenge.starterCode.typescript).toBeUndefined();
      expect(challenge.starterCode.go).toBeUndefined();
    },
  );

  it("refuses another language for a graded challenge without calling lms-api", async () => {
    installLocalStorage();
    const calls = mockFetch(() => {
      throw new Error("must not be called");
    });
    for (const challengeId of Object.keys(BACKEND_CODING_PROBLEMS)) {
      for (const language of ["typescript", "go"] as const) {
        const payload = {
          challengeId: Number(challengeId),
          language,
          code: "export const x = 1;",
        };
        await expect(lmsApi.runCodingPublicTests(payload)).rejects.toThrow(
          /chỉ hỗ trợ Python/,
        );
        await expect(
          lmsApi.submitCodingAllTests({ ...payload, honorCodeAccepted: true }),
        ).rejects.toThrow(/chỉ hỗ trợ Python/);
      }
    }
    expect(calls).toHaveLength(0);
  });

  it("ungraded challenges keep every language that has starter code", () => {
    const ungraded = MOCK_CODING_CHALLENGES.filter(
      (c) => !BACKEND_CODING_PROBLEMS[c.id],
    );
    expect(ungraded.length).toBeGreaterThan(0);
    for (const c of ungraded) {
      const langs = codingLanguagesFor(c);
      expect(langs).toContain("python");
      for (const lang of langs)
        expect(typeof c.starterCode[lang]).toBe("string");
    }
  });
});
