import { bench, group, run } from 'mitata';
import { randomInt as nativeRandomInt } from 'crypto';

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

group('random-int', () => {
  bench('crypto.randomInt', () => {
    nativeRandomInt(3, 7);
  });

  bench('Math.random', () => {
    randomInt(3, 7);
  });
});

run();
