async function simulateDeleteMemoReaction(reaction, delay = 10) {
  return new Promise(resolve => setTimeout(() => resolve(`Deleted ${reaction.name}`), delay));
}

async function runBenchmark() {
  const reactions = Array.from({ length: 100 }, (_, i) => ({ name: `Reaction ${i}` }));

  console.log('--- Baseline: Sequential Execution ---');
  console.time('Sequential');
  for (const reaction of reactions) {
    await simulateDeleteMemoReaction(reaction);
  }
  console.timeEnd('Sequential');

  console.log('\n--- Optimized: Concurrent Execution ---');
  console.time('Concurrent');
  await Promise.all(reactions.map(reaction => simulateDeleteMemoReaction(reaction)));
  console.timeEnd('Concurrent');
}

runBenchmark().catch(console.error);
