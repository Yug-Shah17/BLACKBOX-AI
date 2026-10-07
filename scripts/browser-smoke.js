async (page) => {
  const location = new URL(page.url());
  if (location.protocol !== `http:` || ![`127.0.0.1`, `localhost`].includes(location.hostname)) {
    throw new Error(`Open the local Black Box website before running this check`);
  }
  const base = location.origin;
  const checked = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const comparisonRoute = `**/compare?replay=*`;
  const catalogRoute = `**/api/blackbox/document-scenarios`;

  try {
    await page.route(catalogRoute, route => route.fulfill({ status: 503,
      contentType: `application/json`, body: JSON.stringify({ detail: `Smoke check: catalog unavailable` }) }));
    await page.goto(`${base}/runs`);
    await page.getByRole(`button`, { name: `New run`, exact: true }).click();
    await page.getByText(`Smoke check: catalog unavailable`, { exact: true }).waitFor();
    await page.unroute(catalogRoute);
    await page.getByRole(`button`, { name: `Try again`, exact: true }).click();
    await page.getByRole(`combobox`, { name: `Document set` }).selectOption(`registration`);
    assert(await page.getByRole(`button`, { name: `Execute run`, exact: true }).isEnabled(), `Catalog retry failed`);
    assert(page.url().endsWith(`/runs`), `Catalog retry submitted the form`);
    await page.getByRole(`textbox`, { name: `Question`, exact: true }).fill(`   `);
    await page.getByRole(`button`, { name: `Execute run`, exact: true }).click();
    await page.getByText(`Enter a question containing text.`, { exact: true }).waitFor();
    await page.keyboard.press(`Escape`);
    assert(await page.getByRole(`button`, { name: `New run`, exact: true }).evaluate(button => document.activeElement === button), `Dialog focus was not restored`);
    checked.push(`catalog retry`, `empty question`, `dialog keyboard focus`);

    const cases = [
      { id: `registration`, fault: `missing_retrieval`, step: 1, changed: 4,
        wrong: { documentIds: [] } },
      { id: `eligibility`, fault: `wrong_source`, step: 2, changed: 3,
        wrong: { documentId: `eligibility-archived` } },
      { id: `submission`, fault: `incorrect_citation`, step: 3, changed: 2,
        wrong: { answer: `Unsupported smoke-check answer.`, citation: `submission-current` } },
    ];

    for (const scenario of cases) {
      await page.goto(`${base}/runs`);
      await page.getByRole(`button`, { name: `New run`, exact: true }).click();
      await page.getByRole(`combobox`, { name: `Document set` }).selectOption(scenario.id);
      await page.getByRole(`combobox`, { name: `Execution scenario` }).selectOption(scenario.fault);
      await page.getByRole(`button`, { name: `Execute run`, exact: true }).click();
      await page.waitForURL(/\/trace\/doc_/);
      const originalURL = page.url();
      await page.getByRole(`button`, { name: `Test an alternative`, exact: true }).click();
      assert(await page.getByLabel(`Replay checkpoint`).inputValue() === String(scenario.step), `Wrong diagnosed checkpoint`);
      const input = page.getByRole(`textbox`, { name: `Replacement output` });
      const output = JSON.parse(await input.inputValue());
      if (scenario.step === 1) {
        assert(output.documentIds.length === 2 && !output.documentIds.includes(`${scenario.id}-notice`), `Irrelevant retrieval suggestion`);
      } else {
        assert((output.documentId ?? output.citation) === `${scenario.id}-current`, `Wrong current-source suggestion`);
      }

      if (scenario.id === `eligibility`) {
        await page.route(comparisonRoute, route => route.fulfill({ status: 503,
          contentType: `application/json`, body: JSON.stringify({ detail: `Smoke check: comparison unavailable` }) }));
      }
      await page.getByRole(`button`, { name: `Execute replay`, exact: true }).click();
      if (scenario.id === `eligibility`) {
        await page.getByText(`Smoke check: comparison unavailable`, { exact: true }).waitFor();
        assert(await page.getByRole(`status`, { name: `Loading records` }).count() === 0, `Comparison failure has an endless spinner`);
        await page.unroute(comparisonRoute);
        await page.getByRole(`button`, { name: `Try again`, exact: true }).click();
        checked.push(`same-branch comparison retry`);
      }
      await page.getByText(`Outcome improved`, { exact: true }).waitFor();
      const goodBranch = (await page.locator(`.comparison-outcomes a`).getAttribute(`href`)).split(`/`).at(-1);
      let proof = await page.locator(`.replay-proof`).innerText();
      assert(proof.includes(`${scenario.step - 1} steps reused`) && proof.includes(`${5 - scenario.step} steps executed`), `Incorrect checkpoint execution proof`);
      assert(proof.includes(`${scenario.changed} steps changed`), `Incorrect successful-branch change count`);
      assert(page.url() === originalURL, `Replay overwrote or replaced original navigation`);

      await page.getByRole(`tab`, { name: `Checkpoint replay`, exact: true }).click();
      await input.fill(JSON.stringify(scenario.wrong));
      await page.getByRole(`button`, { name: `Execute replay`, exact: true }).click();
      await page.getByText(`Execution recorded`, { exact: true }).waitFor();
      const outcomes = await page.locator(`.comparison-outcomes .status`).allTextContents();
      assert(outcomes.length === 2 && outcomes.every(value => value.includes(`Failed`)), `Wrong correction manufactured success`);
      await page.getByLabel(`Compare replay branch`).selectOption(goodBranch);
      await page.getByText(`Outcome improved`, { exact: true }).waitFor();
      proof = await page.locator(`.replay-proof`).innerText();
      assert(proof.includes(`${scenario.changed} steps changed`), `Branch switching retained stale replay evidence`);
      checked.push(`${scenario.id}: corrected replay, wrong replay, branch switching`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const width = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    assert(width.viewport === width.content, `Mobile comparison overflows the page`);
    const download = page.waitForEvent(`download`);
    await page.getByRole(`button`, { name: `Download JSON`, exact: true }).click();
    assert((await download).suggestedFilename().endsWith(`.json`), `Mobile export did not produce JSON`);
    const comparisonDownload = page.waitForEvent(`download`);
    await page.getByRole(`button`, { name: `Download comparison`, exact: true }).click();
    assert((await comparisonDownload).suggestedFilename().endsWith(`-comparison.json`), `Selected comparison export is missing`);
    checked.push(`mobile comparison width`, `mobile JSON export`, `selected comparison export`);
    await page.goto(`${base}/runs`);
    const workflow = page.getByRole(`combobox`, { name: `Filter workflow`, exact: true });
    await workflow.selectOption(`documents`);
    await page.locator(`.runs-table tbody tr`).first().waitFor();
    const rows = await page.locator(`.runs-table tbody tr`).allTextContents();
    assert(rows.every(row => row.includes(`Document agent`)), `Document filter mixes workflows`);
    await page.getByRole(`textbox`, { name: `Search runs`, exact: true }).fill(`nonexistent-smoke-question`);
    await page.getByRole(`button`, { name: `Reset filters`, exact: true }).click();
    assert(await workflow.inputValue() === `all`, `Reset did not clear the workflow filter`);
    checked.push(`workflow history filter`, `filter reset`);
    return { status: `passed`, checked, createdOriginals: 3, createdReplayBranches: 6,
      note: `Uses fictional documents and adds nine local demo records. Expected injected HTTP 503 responses are recovery tests.` };
  } finally {
    await page.unroute(catalogRoute);
    await page.unroute(comparisonRoute);
  }
}
