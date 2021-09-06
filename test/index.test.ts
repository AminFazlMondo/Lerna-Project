import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {LogLevel, TypeScriptProject} from 'projen'
// import * as fs from 'fs-extra'
import {LernaProject} from '../src'

const autoRemove = new Set<string>()

// Hook to automatically remove temporary directories without needing each
// place to actually handle this specifically.
// afterAll((done) => {
//   // Array.from used to get a copy, so we can safely remove from the set
//   for (const dir of Array.from(autoRemove)) {
//     try {
//       // Note - fs-extra.removeSync is idempotent, so we're safe if the
//       // directory has already been cleaned up before we get there!
//       // fs.removeSync(dir)
//       console.log('###DEBUG-dir:', dir)
//     } catch (e) {
//       done.fail(e)
//     }
//     autoRemove.delete(dir)
//   }
//   done()
// })

function mkdtemp() {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'projen-test-'))
  autoRemove.add(tmpdir)
  return tmpdir
}

interface SynthOutput {
  'lerna.json': any;
  'tasks.json': any;
}

function readJson(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

function captureSynth(project: LernaProject): SynthOutput {
  process.env.PROJEN_DISABLE_POST = 'true'
  project.synth()
  const {outdir} = project
  return {
    'lerna.json': readJson(path.join(outdir, 'lerna.json')),
    'tasks.json': readJson(path.join(outdir, '.projen', 'tasks.json')),
  }
}

test('Should generate lerna file and tasks', () => {
  const parentDirectory = mkdtemp()
  const project = new LernaProject({
    name: 'test',
    outdir: parentDirectory,
    defaultReleaseBranch: 'test',
    logging: {
      level: LogLevel.OFF,
    },
  })

  const subProjectDirectory = 'packages/test-sub-project'
  const subProject = new TypeScriptProject({
    name: 'test-sub-project',
    outdir: path.join(parentDirectory, subProjectDirectory),
    defaultReleaseBranch: 'test',
    logging: {
      level: LogLevel.OFF,
    },
  })
  project.addSubProject(subProject)

  const output = captureSynth(project)

  expect(output['lerna.json']).toMatchObject({
    packages: [subProjectDirectory],
    version: '4.0.0',
  })

  expect(output['tasks.json']).toEqual(
    expect.objectContaining({
      tasks: expect.objectContaining({
        test: expect.objectContaining({
          steps: expect.arrayContaining([{
            exec: 'lerna run test --stream',
          }]),
        }),
        default: expect.objectContaining({
          steps: expect.not.arrayContaining([{
            exec: 'lerna run test --stream',
          }]),
        }),
      }),
    }),
  )
})

describe('Unhappy Path', () => {

  describe('output directory', () => {

    test('Should fail if sub project does not have output directory', () => {
      const parentDirectory = mkdtemp()
      const project = new LernaProject({
        name: 'test',
        outdir: parentDirectory,
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })

      const subProject = new TypeScriptProject({
        name: 'test-sub-project',
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })
      expect(() => project.addSubProject(subProject)).toThrow('A sub project out dir should exists within the lerna package')
    })

    test('Should fail if sub project does not have output directory outside of parent root', () => {
      const parentDirectory = mkdtemp()
      const project = new LernaProject({
        name: 'test',
        outdir: parentDirectory,
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })

      const subProject = new TypeScriptProject({
        name: 'test-sub-project',
        outdir: mkdtemp(),
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })
      expect(() => project.addSubProject(subProject)).toThrow('A sub project out dir should exists within the lerna package')
    })

    test('Should fail adding two sub projects with the same output directory', () => {
      const parentDirectory = mkdtemp()
      const project = new LernaProject({
        name: 'test',
        outdir: parentDirectory,
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })
      const subProjectDirectory = 'packages/test-sub-project'
      const subProject1 = new TypeScriptProject({
        name: 'test-sub-project-1',
        outdir: path.join(parentDirectory, subProjectDirectory),
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })
      project.addSubProject(subProject1)

      const subProject2 = new TypeScriptProject({
        name: 'test-sub-project-2',
        outdir: path.join(parentDirectory, subProjectDirectory),
        defaultReleaseBranch: 'test',
        logging: {
          level: LogLevel.OFF,
        },
      })
      expect(() => project.addSubProject(subProject2)).toThrow('A sub project is defined with the same output path')
    })

  })

})