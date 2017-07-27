import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
import * as assert from "assert";
import * as os from 'os'

@suite class AsyncIO {

  @test async "Does testing work"() {
    assert.equal(true, true, "Basic Test Example");
  }

}