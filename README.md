# ctfd2pages

Links rot, which would be especially sad when you have a beautifully themed
CTFd website :(. None of the existing CTFd archival technologies archive the
entire website and keep it browsable; in most cases, they only archive the
handouts and the challenge descriptions.

This is why we created ctfd2pages. Github Pages can now host a static version
of a CTFd site long after the CTF event is over.

Challenges that need special hosting requirements, such as netcat-based
challenges, are not in scope of this project, unfortunately. Though I guess
you can try to figure the challenges out from the given handouts (if any) or
public releases of challenge source code repositories (if available).

### Examples

A ~~picture~~ live site is worth a thousand words:

- UIUCTF [2020](https://2020.uiuc.tf/), [2021](https://2021.uiuc.tf/),
  [2022](https://2022.uiuc.tf/)
- MapleCTF [2022](https://ctf2022.maplebacon.org/)
- SekaiCTF [2022](https://2022.ctf.sekai.team/)
- (Feel free to send us a PR and add yours here)

## Usage

It's mostly just bash and JavaScript. To install JS dependencies:

```bash
$ npm install
```

This tool is separated into many stages, each does a different operation.
To see usage information:

```bash
$ ./stage
Usage: ./stage [stage number]
Stages:

  ./stage 00            init
  ./stage 01            scrape
  ./stage 02            json_resolve
[...]
```

Each stage will operate on the git repository, but will not push unless
otherwise specified. To see what each stage does check `run.sh` for the
commit title, and `stage.sh` for the executed commands.

Feel free to ask on the [SIGPwny Discord](https://sigpwny.com/discord) if you
need help or have any questions.

### GitHub Pages Setup

Follow [GitHub documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
In particular, you need to setup a `CNAME` DNS record on your DNS provider to
`<user>.github.io` or `<organization>.github.io`. You also need to set the
"Custom domain" setting under GitHub Pages settings for the repository.

## License

Copyright 2022 SIGPwny  
Copyright 2022 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

&emsp; http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
