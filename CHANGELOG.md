# Changelog

## [0.29.1](https://github.com/usememos/memos/compare/v0.29.0...v0.29.1) (2026-06-04)


### Bug Fixes

* **markdown:** keep task item content in one grid column ([7c3bff4](https://github.com/usememos/memos/commit/7c3bff4e98223fb99a5d49f093e3cd57dd140ba4))
* support &lt;meta name=description&gt; in link previews ([#6000](https://github.com/usememos/memos/issues/6000)) ([e8d32e8](https://github.com/usememos/memos/commit/e8d32e87d1d6e4927250ad5794ba5965e0260153))
* **web:** render video attachment posters on mobile ([0e2a9a9](https://github.com/usememos/memos/commit/0e2a9a9c0ce0e2da63535210c553b3ae2f79b239))

## [0.29.0](https://github.com/usememos/memos/compare/v0.28.0...v0.29.0) (2026-05-27)


### Features

* **about:** add about page with bird sprites ([411ba7b](https://github.com/usememos/memos/commit/411ba7b34c0c23ad217a7897835097887a28a036))
* **activity-calendar:** aggregate by ViewContext.timeBasis ([8daef1d](https://github.com/usememos/memos/commit/8daef1dc89544512fff78fd64d8216b2babc2e42))
* add &lt;Placeholder&gt; component with ASCII bird states ([#5949](https://github.com/usememos/memos/issues/5949)) ([8c16ffa](https://github.com/usememos/memos/commit/8c16ffa1f1410f9413cb57ebe251b4b604f9aeff))
* add configurable `--log-level` flag ([#5934](https://github.com/usememos/memos/issues/5934)) ([f1e2a06](https://github.com/usememos/memos/commit/f1e2a06b46c7f45ba6562c308d2703fdfb4067b0))
* add dedicated shortcuts page ([#5942](https://github.com/usememos/memos/issues/5942)) ([1df6479](https://github.com/usememos/memos/commit/1df6479443c334732b862d60a0f76e61f00ebb89))
* add link metadata endpoints ([9c5c604](https://github.com/usememos/memos/commit/9c5c604944428d3f682f35c9d05a87c1d4c3152f))
* **frontend:** add pixel bird tilemaps ([cf55f11](https://github.com/usememos/memos/commit/cf55f1107273c928e7c2d6bc26df5f3efea26458))
* **memo:** add task list quick actions ([#5983](https://github.com/usememos/memos/issues/5983)) ([648b3bd](https://github.com/usememos/memos/commit/648b3bd812e5bf2b1abb9f8b3529efefe4734e7c))
* **memo:** create memos on the selected calendar date ([#5925](https://github.com/usememos/memos/issues/5925)) ([ef55013](https://github.com/usememos/memos/commit/ef55013418d68e2d6a24a6d02a0365c1ffff03d7))
* **notification:** add smtp email settings ([cd4f28a](https://github.com/usememos/memos/commit/cd4f28ae1058a125e245ea0a6eae16aea71b8f9d))
* **placeholder:** add woodpecker tilemap ([638e4f3](https://github.com/usememos/memos/commit/638e4f398e90c556f70af150a79538312c8fc760))
* render link metadata cards ([0bc5669](https://github.com/usememos/memos/commit/0bc56694b0ca347ab1eb083f62997a22007b763d))
* **stats:** admin instance resource statistics ([ea0625d](https://github.com/usememos/memos/commit/ea0625da45a419e08158ab4102051f3fe5e59b87))
* **stats:** support filtered all-user stats ([88ac3ec](https://github.com/usememos/memos/commit/88ac3ec31ee3e808db82663c04a31cf730d1221e))
* **transcription:** explicit STT settings with provider, model, prompt ([#5926](https://github.com/usememos/memos/issues/5926)) ([238f27d](https://github.com/usememos/memos/commit/238f27dea149492a78a8994470b0aac55fece78d))


### Bug Fixes

* avoid update event on memo create attachments ([#5961](https://github.com/usememos/memos/issues/5961)) ([3c3382a](https://github.com/usememos/memos/commit/3c3382a3c652bed3b58058931ff3cbf1d875b9a8))
* delete user cleanup ([#5981](https://github.com/usememos/memos/issues/5981)) ([e53b7d9](https://github.com/usememos/memos/commit/e53b7d96e70965529ba3b04ea720ea6966f77b60))
* **editor:** wrap selected text when pasting URL ([e0bb3a2](https://github.com/usememos/memos/commit/e0bb3a2e684e932309df2f9fb0ff774ce8e6b692))
* **fileserver:** preserve HDR image metadata in thumbnails ([c724232](https://github.com/usememos/memos/commit/c7242324a18962e453e7f2a0309a7c07b358bdbe))
* **frontend:** correct static cache headers ([084f40b](https://github.com/usememos/memos/commit/084f40bc9e5922ff2d41c08dce837b96696437aa))
* **frontend:** use correct url path for memos in sitemap.xml ([#5921](https://github.com/usememos/memos/issues/5921)) ([603781f](https://github.com/usememos/memos/commit/603781f792b2603fbda93146988a64a93c92d760))
* **httpgetter:** prevent DNS rebinding in link metadata fetch ([078488c](https://github.com/usememos/memos/commit/078488ca818626fbcab69bdfb4b93b58dca6b6eb))
* **markdown:** align list items with checkboxes ([e008b1a](https://github.com/usememos/memos/commit/e008b1a23c77945eff87707eb15578d4d6d74e4c))
* **memo:** enforce parent visibility for comments ([4a1e401](https://github.com/usememos/memos/commit/4a1e401bd99c7850ac48e9693b25c9ebeecfb042))
* **s3presign:** preserve motion media payload ([7f1f53f](https://github.com/usememos/memos/commit/7f1f53ffc417962f6930d1e6e3783eacd911003d))
* **security:** enforce attachment ownership on memo updates ([35bf761](https://github.com/usememos/memos/commit/35bf761b8c2c3f155bdc06e9b373b6076116a725))
* **sse:** stream initial response and refresh tokens ([21303e8](https://github.com/usememos/memos/commit/21303e879d2c7a857306206d2cbdae83f61983e6))
* **user:** omit internal settings from list responses ([#5917](https://github.com/usememos/memos/issues/5917)) ([1df3fe7](https://github.com/usememos/memos/commit/1df3fe79559ccf94b6c71e9ffb58e870ed43820d))
* **web:** sync avatar changes immediately after profile update ([#5903](https://github.com/usememos/memos/issues/5903)) ([328396a](https://github.com/usememos/memos/commit/328396a97f2219592032e8418c383e0ab7edaca6))


### Performance Improvements

* lazy load heavy first-screen dependencies ([#5947](https://github.com/usememos/memos/issues/5947)) ([a6024ee](https://github.com/usememos/memos/commit/a6024eebf129c4b8fb65ee0cba09c6657274bfde))

## [0.28.0](https://github.com/usememos/memos/compare/v0.27.1...v0.28.0) (2026-04-27)


### Features

* **auth:** add SSO user identity linkage ([#5883](https://github.com/usememos/memos/issues/5883)) ([d688914](https://github.com/usememos/memos/commit/d688914b2864791eeadbf21c882608632875f17c))
* **memos:** choose created or updated time for memos ([#5894](https://github.com/usememos/memos/issues/5894)) ([c268551](https://github.com/usememos/memos/commit/c268551a16929a2cbea6891951feff91926bba59))
* redesign account and SSO management ([#5886](https://github.com/usememos/memos/issues/5886)) ([ee17998](https://github.com/usememos/memos/commit/ee1799851e88674a6920c7a56d93428fcf95e662))


### Bug Fixes

* **auth:** harden authorization and username validation ([#5890](https://github.com/usememos/memos/issues/5890)) ([0fb83a7](https://github.com/usememos/memos/commit/0fb83a745dd5057ade45a3caad2c444af2239113))
* disable modal prop on DropdownMenu to prevent scroll disappearing ([#5861](https://github.com/usememos/memos/issues/5861)) ([d98f665](https://github.com/usememos/memos/commit/d98f6659190b8d1a8252e64549d9120d85e05d33))
* fix legacy username auth flows ([#5885](https://github.com/usememos/memos/issues/5885)) ([30c0611](https://github.com/usememos/memos/commit/30c0611a82f9254952a74650095105254f2940e4))
* **markdown:** split mixed task and bullet lists ([e2c6084](https://github.com/usememos/memos/commit/e2c60845eaff9a78b8d8eb3ccc9a067ef5690976))
* reduce list memo query overhead ([#5880](https://github.com/usememos/memos/issues/5880)) ([5063804](https://github.com/usememos/memos/commit/50638040f618b02b0c6d010e1d41554c75067517))
* **web:** preserve task checkbox state ([#5867](https://github.com/usememos/memos/issues/5867)) ([b5863d7](https://github.com/usememos/memos/commit/b5863d76be3cfbf3e0f8237d8e762122b5a0a679))

## [0.27.1](https://github.com/usememos/memos/compare/v0.27.0...v0.27.1) (2026-04-19)


### Bug Fixes

* mixed-case user resource names ([#5853](https://github.com/usememos/memos/issues/5853)) ([01be01f](https://github.com/usememos/memos/commit/01be01f4b7676af41bdd1758b1e9b096aa922546))
* **release:** inject build version into artifacts ([f8a304b](https://github.com/usememos/memos/commit/f8a304bae33086320b39095d631288156eec4249))
* user resource names can be uuidv4 from idp sub claim ([#5856](https://github.com/usememos/memos/issues/5856)) ([bbded58](https://github.com/usememos/memos/commit/bbded584ce85a856d863485768e08b53adec7244))

## [0.27.0](https://github.com/usememos/memos/compare/v0.26.2...v0.27.0) (2026-04-18)


### Features

* add --allow-private-webhooks flag to bypass SSRF protection ([#5694](https://github.com/usememos/memos/issues/5694)) ([cd5816c](https://github.com/usememos/memos/commit/cd5816c428931f56561f7d48b649a33858812539))
* add blur_content attribute to tag metadata settings ([#5767](https://github.com/usememos/memos/issues/5767)) ([45b2153](https://github.com/usememos/memos/commit/45b21530d9ebbc730e77bcbcf407f4c295b52e93))
* add Gemini transcription provider ([#5830](https://github.com/usememos/memos/issues/5830)) ([d87539a](https://github.com/usememos/memos/commit/d87539a1e1261590ab355220e33fa0ae00bd9431))
* add GitHub release installer and release workflow ([1ed542c](https://github.com/usememos/memos/commit/1ed542c21db421e9aa0cc47417a92c6bd103e257))
* add live refresh via Server-Sent Events (SSE) with visual indicator ([#5638](https://github.com/usememos/memos/issues/5638)) ([ea0892a](https://github.com/usememos/memos/commit/ea0892a8b26d8806a093e3a942562dfc22794f68))
* add MCP server with PAT authentication ([47d9414](https://github.com/usememos/memos/commit/47d9414702dc18966af385352b960bfe451511b7))
* add outline navigation to memo detail sidebar ([#5771](https://github.com/usememos/memos/issues/5771)) ([6b30579](https://github.com/usememos/memos/commit/6b3057990396f9cb6f21706c2e99dddebc35ffd5))
* **ai:** add BYOK audio transcription ([#5832](https://github.com/usememos/memos/issues/5832)) ([101704c](https://github.com/usememos/memos/commit/101704c8eac17c7f34508d8db6c53bc972061cdb))
* **ai:** add instance AI providers and transcription ([#5829](https://github.com/usememos/memos/issues/5829)) ([83ed32f](https://github.com/usememos/memos/commit/83ed32f1195841d2d6c057c3e00086a3147879a2))
* **attachments:** add Live Photo and Motion Photo support ([#5810](https://github.com/usememos/memos/issues/5810)) ([4b4e719](https://github.com/usememos/memos/commit/4b4e719470184e49cd62084b1aa53c9a777a9fec))
* **cli:** add version subcommand ([#5731](https://github.com/usememos/memos/issues/5731)) ([0ba4c0f](https://github.com/usememos/memos/commit/0ba4c0f397c532a5a314f35ddeb3ce3633e84d42))
* **editor:** add voice note recording to the memo composer ([#5801](https://github.com/usememos/memos/issues/5801)) ([c0d5854](https://github.com/usememos/memos/commit/c0d5854f678f357cf4054d448e0311f2ee90f8ac))
* extract title from first H1 heading into memo property ([#5726](https://github.com/usememos/memos/issues/5726)) ([1e688b2](https://github.com/usememos/memos/commit/1e688b2a5d78c2972f4b0078a7b033dae5d1cbf3))
* **i18n:** update sse connect label in Chinese ([#5732](https://github.com/usememos/memos/issues/5732)) ([89c6902](https://github.com/usememos/memos/commit/89c69028953fa33dbb6e0e257d764636c0fc2d09))
* **instance:** add canonical tag metadata setting ([#5736](https://github.com/usememos/memos/issues/5736)) ([65d14fb](https://github.com/usememos/memos/commit/65d14fbb63053fc1fbf1f63881c81adbc9d01671))
* **instance:** add notification transport setting ([#5737](https://github.com/usememos/memos/issues/5737)) ([a249d06](https://github.com/usememos/memos/commit/a249d06e2e0f33e0e3fea34471a891352dacc466))
* **mcp:** enhance MCP server with full capabilities and new tools ([#5720](https://github.com/usememos/memos/issues/5720)) ([b8e9ee2](https://github.com/usememos/memos/commit/b8e9ee2b26a59e1b19aab6db3ca39656fc18785a))
* **mcp:** harden tool exposure and side effects ([#5850](https://github.com/usememos/memos/issues/5850)) ([583c3d2](https://github.com/usememos/memos/commit/583c3d24f4d785faa5e034c1b88ed90eda119baa))
* **mcp:** refactor MCP server to standard protocol structure ([803d488](https://github.com/usememos/memos/commit/803d488a5f8f55477cd3ad4cc4cf0fac98901dd3))
* **memo-editor:** add compact live waveform recorder panel ([#5817](https://github.com/usememos/memos/issues/5817)) ([e51985a](https://github.com/usememos/memos/commit/e51985a29ffeeecd318b2fb793358ed45bb0eff4))
* **memo-preview:** support comment metadata in previews ([#5768](https://github.com/usememos/memos/issues/5768)) ([e176b28](https://github.com/usememos/memos/commit/e176b28c801cc3bb3718208a96a7d64c36620d0f))
* **memo:** add image sharing in detail view ([38fc22b](https://github.com/usememos/memos/commit/38fc22b7541b8a9ddcd848cf77054fcf844eb87f))
* **memo:** add share links for private memos ([#5742](https://github.com/usememos/memos/issues/5742)) ([3f3133d](https://github.com/usememos/memos/commit/3f3133d6e2f404061e147f9dd2424680dc0303a3))
* **mentions:** add memo mention parsing, notifications, and rendering ([#5811](https://github.com/usememos/memos/issues/5811)) ([24fc8ab](https://github.com/usememos/memos/commit/24fc8ab8ca68d092e7b12a5d51c48ca9420f72b5))
* replace auto-increment ID with UID for identity provider resource names ([#5687](https://github.com/usememos/memos/issues/5687)) ([92d937b](https://github.com/usememos/memos/commit/92d937b1aa87365152edc005a3b736e6bf9b9e45))
* show inline comment preview in list view ([3a5d3c8](https://github.com/usememos/memos/commit/3a5d3c8ff92ae5c24559dc4574300d6475820a87))
* **store:** change default storage type to local filesystem ([78efa68](https://github.com/usememos/memos/commit/78efa6802e2fd96c981e86c5b658fb4b5c05091f))
* treat tag setting keys as anchored regex patterns ([#5759](https://github.com/usememos/memos/issues/5759)) ([9e04049](https://github.com/usememos/memos/commit/9e04049632e63f1cf53535773f170c1aa5af7168))
* **ui:** allow navigating between images with arrows in preview dialog  ([#5669](https://github.com/usememos/memos/issues/5669)) ([104d2ec](https://github.com/usememos/memos/commit/104d2ec0a6973e983c46724165fdc0916515ad16))
* **user:** add per-user tag metadata settings ([#5735](https://github.com/usememos/memos/issues/5735)) ([330291d](https://github.com/usememos/memos/commit/330291d4d9fa95649e940001898929b4f6f0367e))
* **web:** add demo mode banner ([#5836](https://github.com/usememos/memos/issues/5836)) ([35504cc](https://github.com/usememos/memos/commit/35504cc8bd6f9921291fb565633d549388a3f948))
* **webhook:** dispatch webhook on memo comment creation ([7c1defb](https://github.com/usememos/memos/commit/7c1defba01fbc91cc81e1a0841cecb6738056db7))


### Bug Fixes

* access token refresh on web app ([#5681](https://github.com/usememos/memos/issues/5681)) ([3010f10](https://github.com/usememos/memos/commit/3010f10eafb49af5aadd71a94b3ef7a6ec71f617))
* add unix socket file permission setting (755 -&gt; 660) ([#5849](https://github.com/usememos/memos/issues/5849)) ([0fc1dab](https://github.com/usememos/memos/commit/0fc1dab28b33f7fdbe9a21cd3bd3affe75dd7f19))
* **api:** appease image size lint ([ff6389a](https://github.com/usememos/memos/commit/ff6389a5ef73772fcb5c132bf1cb169fb4744c00))
* **api:** improve SSE hub design and fix double-broadcast on comments ([c53677f](https://github.com/usememos/memos/commit/c53677fcba202a8eed35c8ecdfaacea5152b8691))
* **api:** make credentials write-only and restrict sensitive settings to admins ([9d3a74b](https://github.com/usememos/memos/commit/9d3a74bcccf934aa2fa95ee240b56cc3b3a25776))
* **api:** reduce memory pressure in backend paths ([c456637](https://github.com/usememos/memos/commit/c45663761d148e94d3e1b30f4810922e7c2571ab))
* **api:** remove public activity service ([#5734](https://github.com/usememos/memos/issues/5734)) ([04f239a](https://github.com/usememos/memos/commit/04f239a2fc74f7090c779a6a7b8a08238fd31b88))
* **api:** restrict user email exposure to self and admins ([#5784](https://github.com/usememos/memos/issues/5784)) ([a24d420](https://github.com/usememos/memos/commit/a24d4209222814e4a8bedfc0392e91462bc855ad))
* **api:** switch user resource names to usernames ([#5779](https://github.com/usememos/memos/issues/5779)) ([acddef1](https://github.com/usememos/memos/commit/acddef1f3dcca44806bcbb85e9dc5cae7daa5285))
* **api:** tolerate missing related users in memo conversions ([#5809](https://github.com/usememos/memos/issues/5809)) ([25feef3](https://github.com/usememos/memos/commit/25feef3aadd34bfd474d7e3b685815a6509bc4c6))
* **auth:** recover session via refresh cookie when localStorage is empty ([#5748](https://github.com/usememos/memos/issues/5748)) ([551ee1d](https://github.com/usememos/memos/commit/551ee1d81f398abdcaf73a0c2b782c8379b0e3f2))
* backend tests action ([065e817](https://github.com/usememos/memos/commit/065e817470b1d3b6b00222525791b85d825c1492))
* clear content search filter when selecting shortcut ([#5499](https://github.com/usememos/memos/issues/5499)) ([2c3f9e3](https://github.com/usememos/memos/commit/2c3f9e3bfbe09e5d0028d1525c1df83c03f547c9))
* correct typos in comments, error messages, and identifiers ([#5704](https://github.com/usememos/memos/issues/5704)) ([8f43e80](https://github.com/usememos/memos/commit/8f43e8075b62706f99da4005ab04b165b35215f6))
* detect legacy installations with empty schema version ([9628d3d](https://github.com/usememos/memos/commit/9628d3de21289e887ffeb6cc4b6710913a0de44e))
* **editor:** show newly linked memos when editing a memo with attachments ([026ea92](https://github.com/usememos/memos/commit/026ea92f7b4005c30ca84340c22018740659ab51))
* ensure comment divs span full width in MemoDetail ([ce44164](https://github.com/usememos/memos/commit/ce441644af34ffff156f1793c40011c2b82e8d5f))
* **fileserver:** render SVG attachment previews ([40fd700](https://github.com/usememos/memos/commit/40fd700fb8be27a8d7a300a2636cf4f366572176))
* **filter:** enforce CEL syntax semantics ([0e89407](https://github.com/usememos/memos/commit/0e89407ee91deda87e0df7464a89d26d1e9a88b3))
* **frontend:** restore sitemap and robots routes ([fee7fcd](https://github.com/usememos/memos/commit/fee7fcd6608b9d07da1f146c33c9bb8f898f708f))
* handle chunk load errors after redeployment with auto-reload ([#5703](https://github.com/usememos/memos/issues/5703)) ([bdd3554](https://github.com/usememos/memos/commit/bdd3554b897246bac5c1e6fd801495c24b6a656e))
* harden memo content iframe and HTML sanitization ([7e21b72](https://github.com/usememos/memos/commit/7e21b728b346e80023c93e8986130f83e70584f9))
* hide transcribe button without AI provider ([ab53329](https://github.com/usememos/memos/commit/ab5332901fd6626f0a2ae6b99671af9663f68078))
* improve image preview dialog and live photo trigger ([aafcc21](https://github.com/usememos/memos/commit/aafcc21ae6f96a313fb372365dd1af8a1a69d1ba))
* improve installer compatibility and docs ([f90d9a4](https://github.com/usememos/memos/commit/f90d9a49a78d0764a6c5cf8f6720e69ea1164b25))
* improve KaTeX and Mermaid error handling and overflow ([6b37fcc](https://github.com/usememos/memos/commit/6b37fcc01b5dcded6a2ec254fbaf895f7812d072))
* include plain URLs and tags in memo snippet generation ([#5688](https://github.com/usememos/memos/issues/5688)) ([3d4f793](https://github.com/usememos/memos/commit/3d4f793f97b567bda823a60b7fe10e09e14499ce))
* **lint:** correct goimports struct literal alignment after removing write-only credential fields ([#5794](https://github.com/usememos/memos/issues/5794)) ([9610ed8](https://github.com/usememos/memos/commit/9610ed8fc809b3e7aa4b93e4909634957fa94cf7))
* **map:** align dark mode map styling ([7ac9989](https://github.com/usememos/memos/commit/7ac9989d43f3967b466f340da3841290d86b20f1))
* **map:** refine Leaflet controls and memo map styling ([894b3eb](https://github.com/usememos/memos/commit/894b3eb045c7d2c2acce847c34a85295c909dcf7))
* **markdown:** support height/width attributes on img elements ([737acbb](https://github.com/usememos/memos/commit/737acbba2f5e3dd911da3a77d2d5d1cde1bf8ba1))
* **memo-editor:** scope Cmd+Enter save to the active editor ([#5745](https://github.com/usememos/memos/issues/5745)) ([05810e7](https://github.com/usememos/memos/commit/05810e7882cb03d448d9d8fa84bc6ca54eafbed0))
* **mysql:** handle CreateMemo custom timestamps with FROM_UNIXTIME ([#5673](https://github.com/usememos/memos/issues/5673)) ([09d73e8](https://github.com/usememos/memos/commit/09d73e8b6e16c43a61767817909a472916c83daa))
* normalize attachment MIME types before validation ([c3e7e2c](https://github.com/usememos/memos/commit/c3e7e2c316d01bf857931c38303efc87307f2a19))
* preserve draft content when tab is suspended or editor remounts ([9ca7122](https://github.com/usememos/memos/commit/9ca71229a6c0dfad44b76ed06fced46c5bef49c7))
* prevent local attachment uploads from overwriting files ([4add9b0](https://github.com/usememos/memos/commit/4add9b04ad5d0b7608c985281f5975dc39f9a572))
* prevent stale comment drafts from being restored ([e520b63](https://github.com/usememos/memos/commit/e520b637fd8d0f6331674003abe72f9dfbae8231))
* remove duplicate Japanese locale keys ([efeb28c](https://github.com/usememos/memos/commit/efeb28c872a2bd6edd28fa3b68bd0b15af923d50))
* render audio attachments as inline players ([#5699](https://github.com/usememos/memos/issues/5699)) ([2ccb98a](https://github.com/usememos/memos/commit/2ccb98a6cbc40544e81eeeca2a2cbbaf8348f45e))
* restrict archived memo access to creator only ([#5707](https://github.com/usememos/memos/issues/5707)) ([f4154d0](https://github.com/usememos/memos/commit/f4154d090be3896c8e0dd83440f24953bbeb308c))
* **routing:** redirect unauthenticated users to /explore when public visibility is allowed ([98859eb](https://github.com/usememos/memos/commit/98859eb5e5065a7c12ada983b7c38c5af5035bb6))
* **server:** close SSE clients during shutdown ([a5ddd5a](https://github.com/usememos/memos/commit/a5ddd5adafef282f00b23e00e145119d4316f24f))
* sync html lang attribute with active locale ([#5753](https://github.com/usememos/memos/issues/5753)) ([be00abe](https://github.com/usememos/memos/commit/be00abe852479820b7c574e15e276d70961ab7bd))
* tag parsing truncates emojis with variation selectors ([#5496](https://github.com/usememos/memos/issues/5496)) ([3ea6ea3](https://github.com/usememos/memos/commit/3ea6ea3108f58dc34f39fa6f21d761bd2e97732b))
* **tags:** allow blur-only tag metadata ([#5800](https://github.com/usememos/memos/issues/5800)) ([1921b57](https://github.com/usememos/memos/commit/1921b57662c2129d179930f71e5c42caf9070a19))
* toggle focus mode do not reset editor height ([#5504](https://github.com/usememos/memos/issues/5504)) ([0729779](https://github.com/usememos/memos/commit/0729779e0427c68bdbc5b6b711a5683f66ba9bbc))
* **ui:** show comment editor above the comment list ([#5662](https://github.com/usememos/memos/issues/5662)) ([6b0736b](https://github.com/usememos/memos/commit/6b0736b29325ff7698b7395dc761f2ca41e6521c))
* **ui:** unify metadata component styles across MemoView and MemoEditor ([664b8c5](https://github.com/usememos/memos/commit/664b8c56290026ba2beb7b75db24c684824b8670))
* unify live photo previews around LIVE badge playback ([6b0487d](https://github.com/usememos/memos/commit/6b0487dcd857ba72189ca0624cb4985961f08f25))
* **webhooks:** trigger memo updates for attachment and relation changes ([#5795](https://github.com/usememos/memos/issues/5795)) ([acbc914](https://github.com/usememos/memos/commit/acbc914dea8d4e533028b03929193a4af1ac32b4))
* **web:** prevent MemoContent prop leaks ([22519b5](https://github.com/usememos/memos/commit/22519b57a0a971ab927a03015c994c63b8c3f1da))
* **web:** refine attachment media layout ([a0d83e1](https://github.com/usememos/memos/commit/a0d83e1a9e9d0ba50a0103e594adb011728faf8c))
* **web:** refresh memo detail cache after editor save ([333c9df](https://github.com/usememos/memos/commit/333c9df233240a843a9e62d17c6ff464690636f8))
* **web:** use BroadcastChannel to sync token refreshes across tabs ([bbdc998](https://github.com/usememos/memos/commit/bbdc998646e8093223a448378a2c29690f0d8612))


### Performance Improvements

* batch load memo relations when listing memos ([#5692](https://github.com/usememos/memos/issues/5692)) ([1e82714](https://github.com/usememos/memos/commit/1e82714a52c72455a6ba02605cc641d7ad4fbf1a))
