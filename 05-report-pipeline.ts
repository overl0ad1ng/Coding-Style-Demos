type Row = { tenantId: string; settled: boolean; voided: boolean; amountCents: number };
type Bag = Record<string, any>;
type Stage = { mode: string; input: string; output: string; value?: unknown };

function read(bag: Bag, key: string) {
  return bag[key];
}

function write(bag: Bag, key: string, value: any) {
  bag[key] = value;
  return bag;
}

function yes(value: any) {
  return Boolean(value);
}

function same(left: any, right: any) {
  return left === right;
}

function next(bag: Bag, stage: Stage) {
  const source = read(bag, stage.input);
  if (stage.mode === 'a') {
    return write(bag, stage.output, source.filter((row: Row) => same(row.tenantId, stage.value)));
  }
  if (stage.mode === 'b') {
    return write(bag, stage.output, source.filter((row: Row) => yes(row.settled)));
  }
  if (stage.mode === 'c') {
    return write(bag, stage.output, source.filter((row: Row) => !yes(row.voided)));
  }
  if (stage.mode === 'd') {
    return write(bag, stage.output, source.reduce((sum: number, row: Row) => sum + row.amountCents, 0));
  }
  return bag;
}

function execute(bag: Bag, stages: Stage[]) {
  return stages.reduce((current, stage) => next(current, stage), bag);
}

export function dailyReport(rows: Row[], tenantId: string) {
  const bag = execute({ x: rows }, [
    { mode: 'a', input: 'x', output: 'y', value: tenantId },
    { mode: 'b', input: 'y', output: 'z' },
    { mode: 'c', input: 'z', output: 'q' },
    { mode: 'd', input: 'q', output: 'r' },
  ]);
  return { count: read(bag, 'q').length, totalCents: read(bag, 'r') };
}
