# Séries planejadas vs. feitas: rótulos e ajuda na Current Workout

Pesquisa feita em novembro de 2026 para decidir como renomear os botões "Add" e "Plan" do Setlist e como explicar a diferença entre uma série **done** e uma série **planned**, no celular, na academia.

## Resumo

1. **Nenhum app estabelecido tem dois botões de criação ("fiz" vs. "vou fazer").** Strong, Hevy, Liftosaur, StrongLifts e Boostcamp usam o mesmo modelo: as linhas da série já vêm preenchidas com a meta (template, routine, programa) e o usuário **toca num check/círculo para concluir**. O "Add" do Setlist é, na prática, um atalho de "criar + marcar como feita" num toque só.
2. **O vocabulário do mercado se divide entre "log" e "complete".** Boostcamp, JEFIT e StrongLifts falam em *log a set* (o Fitbod provavelmente também, mas não confirmei); Strong, Hevy e Liftosaur falam em *mark/complete a set*. O glossário do Setlist (`CONTEXT.md`) já diz que Sets são "logged", então **"Log set"** é o verbo que encaixa no domínio.
3. **Nenhum app pesquisado explica done vs. planned com tooltip ou coach mark.** Eles contam com o affordance do check, com a meta pré-preenchida e, no máximo, com um aviso ao terminar o treino ("Some sets are not marked as completed", no Liftosaur).
4. **Tooltip por hover não serve no celular.** NN/g: tooltips "are not normally available on touchscreens", e informação necessária para a tarefa deve ficar na tela. Coach marks costumam ser descartadas sem leitura. O padrão mais barato e mais robusto é **uma linha de helper text sempre visível**; uma toggletip (botão "i") é opcional.
5. **Rótulos de botão: verbo + substantivo, específico, sem "Add" genérico** (Polaris, Apple HIG, Microsoft, Mailchimp, NN/g). "Add" e "Plan" sozinhos não dizem o que muda (o estado da série).

## 1. Como os apps nomeiam e explicam a diferença

| App | Rótulo para série feita | Rótulo para série planejada / meta | Como marca como feita | Como explica | Fonte |
|---|---|---|---|---|---|
| **Strong** | "complete it by hitting the checkbox" | **Workout Template** ("known previously as Routine"); template "does not correspond to an actual workout" e nele "Sets cannot be completed" | Checkbox por série | Artigo da central de ajuda; tags de série (Warm-up, Drop, Failure) via toque no número da série. Coluna "Previous": **não verificada** em fonte primária | [229](https://help.strongapp.io/article/229-my-first-workout), [105](https://help.strongapp.io/article/105-about-templates), [166](https://help.strongapp.io/article/166-set-tags) |
| **Hevy** | "mark sets as completed to start the automatic rest timer" | **Routine**: "a reusable workout template"; botões "Start Routine" e "+ Start Empty Workout" | Marcar a série como completa (legenda de imagem: "a set marked as complete"). O nome exato do controle não aparece no texto | Coluna/aba **PREVIOUS** com o valor da última vez; tipo de série pelo número na coluna SET | [track-workouts](https://www.hevyapp.com/features/track-workouts/), [workout-settings](https://www.hevyapp.com/features/workout-settings/), [set-types](https://www.hevyapp.com/features/workout-set-types/) |
| **JEFIT** | "Log weight and reps for each set as you go" | **Plan** / routine ("Open your plan in the Workout tab, pick a workout day and tap Start Workout") | Registrar peso e reps por série. Controle exato **não verificado** | "JEFIT pre-fills each set on the log screen with what you did last time"; tipos warm-up, working, failure, drop | [FAQ](https://www.jefit.com/support/faq), [logging](https://www.jefit.com/use-case/workout-logging-app) |
| **Fitbod** | "Log Set" (só no app WearOS, visto em resultado de busca; a página retornou 403) | **Recommendations** de peso e reps geradas pelo app | Controle do celular **não verificado** em fonte primária | Descrição da App Store: "Adaptive AI learns from your edits to its workout recommendations" | [App Store](https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543), [WearOS (403)](https://help.fitbod.me/hc/en-us/articles/4406074415383-WearOS-on-Android) |
| **Boostcamp** | "Tap to log a set. The timer auto-starts." | **Program** com "target sets and reps" | Tocar na série | "Boostcamp shows the exercise, target sets and reps, and your last logged weight" | [workout-tracker](https://www.boostcamp.app/workout-tracker) |
| **StrongLifts** | "Simply tap the red circles to mark your set completed" | Programa 5×5: o círculo representa a série prescrita | Um toque no círculo = série completa; "Tap the set several times in a row to enter less reps" | Ao terminar: "If some sets are not logged, StrongLifts asks if you want to finish" | [app](https://stronglifts.com/app/), [70](https://support.stronglifts.com/article/70-sets-reps), [111](https://support.stronglifts.com/article/111-apple-watch) |
| **Liftosaur** | "Tap the checkmark to complete the set. The phone vibrates once, and the rest timer starts." | **Target** do programa ("the target shows the exact weight crossed out" quando não bate com as anilhas) | Checkmark por série; "The next unfinished set expands" | Miniatura mostra "completed sets over total, like `2/5`"; ao terminar: "Some sets are not marked as completed."; botões "Add Warmup Set" e "Add Set" | [workout-screen](https://www.liftosaur.com/features/workout-screen), [overview](https://www.liftosaur.com/blog/posts/liftosaur-overview/) |

**Observações:**

- O **StrongLifts** é o análogo mais próximo do modelo do Setlist: a série prevista já existe na tela, um toque a conclui e toques extras ajustam as reps. O **Liftosaur** é o análogo da variante C: progresso "2/5" por exercício e aviso ao finalizar com séries abertas.
- O Strong mostra como comunicar "não conta": "Warm-up sets will not be included in charts or metrics" ([166](https://help.strongapp.io/article/166-set-tags)). É a mesma regra que o Setlist aplica às séries planned.
- Nenhuma fonte primária encontrada descreve tooltip, coach mark ou texto de onboarding explicando "feita vs. planejada". A explicação fica toda no affordance (check ao lado de uma linha pré-preenchida) e na central de ajuda.
- Lacunas: não consegui ler a central de ajuda do Hevy nem a do Fitbod (HTTP 403). O nome do controle de conclusão no celular, nesses dois apps, fica sem confirmação.

## 2. Tooltips e ajuda contextual em telas de toque

**Hover não existe no toque.**
- NN/g: tooltips são acionados por mouse ou teclado e "are not normally available on touchscreens". No toque, o equivalente são *popup tips* abertos por um ícone "?" ou "i" e fechados com um toque fora ([NN/g, Tooltip Guidelines](https://www.nngroup.com/articles/tooltip-guidelines/)).
- Apple HIG: o *tooltip* (help tag) aparece só como consideração de macOS e visionOS, quando o ponteiro para sobre o elemento. Para iOS a HIG fala em *tips*: "a small, transient view", em popover ou inline, de "one or two sentences" ([HIG, Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)).
- Material 3 no Android: tooltips aparecem por "Hovering over the icon with a cursor" ou "Long-pressing the icon on a mobile device". *Plain tooltips* "Describe elements or actions of icon buttons"; *rich tooltips* trazem mais detalhe, título e ações ([Android Developers, Tooltip](https://developer.android.com/develop/ui/compose/components/tooltip)). Long press é um gesto escondido, ruim para quem nem sabe que precisa de ajuda. As páginas de diretrizes em m3.material.io não renderizaram para leitura (são client-side), então não cito o texto delas.

**Informação necessária fica na tela.**
- NN/g: "Users shouldn't need to find a tooltip in order to complete their task" e "Important information should always be on the page". Não repita o rótulo no tooltip ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)).
- "Série planned não conta nas métricas" é informação necessária para não registrar errado, então deve ficar visível e não escondida atrás de um gesto.

**Toggletip quando houver uma segunda frase.**
- Inclusive Components: tooltips falham no toque porque "the focus and active states happen simultaneously"; *toggletips* abrem por clique e funcionam com mouse, teclado e toque. Use uma live region para o leitor de tela anunciar o conteúdo e feche com toque fora, Esc ou perda de foco ([Inclusive Components](https://inclusive-components.design/tooltips-toggletips/)).

**Coach marks: só para algo realmente atípico, uma por vez.**
- NN/g: usuários "tend to dismiss them quickly and do not read thoroughly"; prefira dicas contextuais, *just-in-time*, uma interação por dica, sem sequências ([NN/g, Instructional overlays](https://www.nngroup.com/articles/mobile-instructional-overlay/)).
- Apple: tips servem para recursos simples ("more than three actions" é complicado demais) e devem aparecer só para quem se beneficia, com regras de elegibilidade ([HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help)). Isso exige estado persistido por usuário, que é infraestrutura extra.

**Acessibilidade de conteúdo que aparece e some.**
- WCAG 1.4.13 (Content on Hover or Focus): o conteúdo extra precisa ser *Dismissible*, *Hoverable* e *Persistent* ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)).
- O padrão Tooltip da APG usa `role="tooltip"` e `aria-describedby`, fecha com Escape e ainda está marcado como "work in progress; it does not yet have task force consensus" ([APG Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)).
- Evite o atributo `title`: não é alcançável por teclado e muitos leitores de tela o ignoram ([Inclusive Components](https://inclusive-components.design/tooltips-toggletips/)).

**Botões de ícone e checkboxes.**
- NN/g: "we recommend text labels for all icons"; tooltip é só o plano B ([NN/g](https://www.nngroup.com/articles/tooltip-guidelines/)).
- WCAG 2.5.3 (Label in Name): o nome acessível precisa conter o texto visível, e "A best practice is to have the text of the label at the start of the name" ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)).
- APG, botões alternáveis: use `aria-pressed`, e "it is critical the label on a toggle does not change when its state changes" ([APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)). Num checkbox, o estado vem de `aria-checked` (ou do `<input type="checkbox">` nativo), e o nome também fica fixo.
- Alvo de toque: WCAG 2.5.8 pede pelo menos 24×24 px CSS; a 2.5.5 (AAA) usa 44×44 ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). A Apple pede "a hit region of at least 44x44 pt" ([HIG, Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).

## 3. Como escrever rótulos que diferem só em tempo ou estado

- **Verbo + substantivo.** Polaris: "Buttons should always lead with a strong verb" e "use the {verb}+{noun} format", exceto ações comuns como Save, Close, Cancel e OK. Exemplos: "Create order" em vez de "New order"; "Buy shipping label" em vez de "Buy"; "Add menu item" em vez de "Add a menu item" ([Polaris Button, docs arquivadas](https://unpkg.com/@shopify/polaris@2.7.0/docs/components/Button/README.md); [Shopify app design guidelines](https://shopify.dev/apps/design-guidelines/content)).
- **Específico vence genérico.** NN/g: "It's often better to name a button to explain what it does than to use a generic label"; um rótulo explícito "serves as just-in-time help" ([NN/g, OK–Cancel](https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/)). Microsoft: "Use a concise, specific, self-explanatory text that clearly describes the action", em geral "a single word that is a verb", com no máximo 26 caracteres ([Windows, Buttons](https://learn.microsoft.com/en-us/windows/apps/design/controls/buttons)).
- **Comece pelo verbo**, como "Add to Cart" ([HIG, Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)). Mailchimp: "Buttons should always contain actions" e "The language should be clear and concise" ([Mailchimp TL;DR](https://styleguide.mailchimp.com/tldr/)).
- **Hierarquia por estilo, não por tamanho.** "use a button that has a prominent visual style for the most likely action" e "Use style — not size — to visually distinguish the preferred choice" ([HIG, Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- **Texto independente do dispositivo.** A Microsoft manda evitar verbos de dispositivo como *click* e *swipe* ([Microsoft Style Guide](https://learn.microsoft.com/en-us/style-guide/procedures-instructions/describing-interactions-with-ui)); a Apple pede termos coerentes com a plataforma ([HIG, Offering help](https://developer.apple.com/design/human-interface-guidelines/offering-help)). No helper text, "tick" funciona tanto no toque quanto no mouse.
- **Texto que muda com o estado é aceitável em ajuda** ("Consider offering context-sensitive tooltips… different text for a control's different states", [HIG](https://developer.apple.com/design/human-interface-guidelines/offering-help)), mas **não** no nome de um toggle (APG, acima).

Aplicado ao Setlist: "Add" é genérico e não diz o estado resultante. "Plan" é um verbo sem objeto e se parece com "planejar o treino", não com "criar uma série que ainda não conta". Os dois falham no teste do verbo + substantivo e no do "específico vence genérico".

## 4. Recomendação para o Setlist

### 4.1 Pares de rótulos (no lugar de "Add" / "Plan")

**Opção 1 (recomendada): "Log set" / "Plan set"**
- Prós: verbo + substantivo; "log" é o termo do glossário (`CONTEXT.md`: "Sets logged") e do mercado (Boostcamp, JEFIT, StrongLifts, Fitbod); curtos o bastante para ficarem lado a lado numa tela de 360 px; o substantivo igual deixa a diferença no verbo, que é justamente o que muda. Na variante C ganha contagem sem perder a forma: **"Log 3 sets" / "Plan 3 sets"**.
- Contras: "Plan" ainda pede uma linha de apoio para dizer que a série planned não conta; quem nunca usou "log" em inglês pode estranhar (o público do app já registra treino, então o risco é baixo).

**Opção 2: "Log set" / "Add to plan"**
- Prós: "plan" vira um lugar (a lista Planned), o que casa com a variante B, que já separa as seções "Planned" e "Done"; "Add to plan" lembra "Add to Cart", da própria HIG.
- Contras: sugere que existe um objeto "plano" separado do Current Workout, e não existe; estruturas diferentes nos dois botões dificultam a leitura rápida; fica mais longo na variante C ("Add 3 to plan").

**Opção 3: "Add as done" / "Add as planned"**
- Prós: mantém o verbo que o usuário já conhece e põe o estado resultante explícito no rótulo, o que dispensa quase toda ajuda extra.
- Contras: a palavra que diferencia fica no fim e some na leitura rápida; "Add" continua genérico; 11 e 14 caracteres apertam dois botões na mesma linha.

Em todas as opções: **o botão de série feita é o primário** (preenchido, `--color-primary`, ícone `Check` do lucide), porque registrar é o caminho mais rápido e mais frequente. O de série planejada é secundário (contorno, ícone `CalendarClock` ou `ListPlus`). Tamanhos iguais, hierarquia só pelo estilo (HIG).

**Variante B (toggle):** "Done now" / "Planned" mistura locução adverbial com adjetivo. Use pares paralelos, ambos estados: **"Done" / "Planned"**, com o botão de envio mudando para "Log set" / "Plan set". Se o par escolhido for a opção 1, as variantes A e C nem precisam do toggle.

### 4.2 Controle de "tick" (marcar uma série planned como feita)

- **Um único modelo ARIA nas três variantes: checkbox.** Use `<input type="checkbox">` nativo, estilizado como círculo, ou `<button role="checkbox" aria-checked>`. Strong, Hevy e Liftosaur usam esse mesmo modelo de um check por série. Marcado = done, desmarcado = planned. Que desmarcar devolva a série a planned é decisão do Setlist; não confirmei esse comportamento nos outros apps em fonte primária.
- **Nome acessível fixo, com o contexto da linha**, começando pela palavra visível (WCAG 2.5.3):
  `aria-label="Done: Bench press, set 2, 80 kg × 5"` (montado com `formatWeight` e `load()`). O leitor anuncia "…checkbox, not checked" ou "…checked"; o nome não muda com o estado (APG).
- **Rótulo visível:**
  - A: só o círculo, mas a linha planned mostra a tag de texto **"Planned"**, e não só o tracejado, para o estado não depender só do visual.
  - B: o botão das linhas planned diz **"Done"** com ícone `Check`. Como ele move a linha para a seção Done, use o mesmo checkbox estilizado como botão com texto (nome "Done: …"). Na seção Done, a linha mostra o check marcado, que desmarca.
  - C: o mesmo círculo por série dentro do grupo, mais o progresso **"1 of 3 done"** no cabeçalho do movimento (como o "2/5" do Liftosaur), anunciado via `aria-live="polite"`.
- **Área de toque:** pelo menos 44×44 px, mesmo que o círculo desenhado tenha 24 px (HIG; WCAG 2.5.5).

### 4.3 Padrão de ajuda (enxuto, sem infraestrutura de onboarding)

**Sempre visível: uma linha de helper text logo abaixo dos botões** (`text-sm text-slate-500`, ligada aos dois botões por `aria-describedby`). Ela não depende de hover nem de long press, não exige estado persistido e segue a regra da NN/g de manter na tela o que é necessário.

- Variantes A e C:
  > **Log** what you just lifted. **Plan** sets for later — they count once you tick them.
- Variante B (a ajuda muda com o toggle, como a HIG sugere para estados diferentes):
  - Done: > Counts in your history and charts right away.
  - Planned: > Won't count until you tick it Done.

**Estado vazio da lista** (quando ainda não há nenhuma série planned, ou na seção Planned vazia da variante B):
> No planned sets. Use **Plan set** to line up the rest of your workout, then tick each one as you finish it.

**Confirmação após criar uma série planned** (toast que já existe no app, sem botão):
> Set planned. Tick it when it's done.

**Opcional, só se o usuário de teste ainda se confundir:** um botão "i" de 44 px ao lado dos botões, abrindo uma toggletip (clique, não hover) com duas frases:
> **Log set** saves a set you've finished. It counts in your history and charts.
> **Plan set** saves a set you're about to do. It stays unticked and doesn't count until you tick it.

Feche com toque fora ou Esc e anuncie por live region (Inclusive Components). **Não recomendo** coach mark nem tour de primeira execução: a NN/g mostra que são descartados sem leitura, e o "mostrar uma vez" exige guardar estado por usuário, o que é desproporcional para um take-home.

**Exibição:** helper text **sempre**; toast **a cada** série planned criada (é curto e confirma o estado); toggletip **sob demanda**.

### 4.4 Para o glossário (sugestão, fora deste arquivo)

Vale incluir **Planned Set** no `CONTEXT.md` ("A Set written ahead of time in the Current Workout. It does not count in history, charts or metrics until the user ticks it as done") e usar "log" e "tick" de forma consistente na UI e nos commits.

## Fontes

**Apps**
- Strong: https://help.strongapp.io/article/229-my-first-workout
- Strong: https://help.strongapp.io/article/105-about-templates
- Strong: https://help.strongapp.io/article/166-set-tags
- Strong: https://help.strongapp.io/article/177-update-template
- Strong (App Store): https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
- Hevy: https://www.hevyapp.com/features/track-workouts/
- Hevy: https://www.hevyapp.com/features/workout-settings/
- Hevy: https://www.hevyapp.com/features/workout-set-types/
- JEFIT: https://www.jefit.com/support/faq
- JEFIT: https://www.jefit.com/use-case/workout-logging-app
- Fitbod (App Store): https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543
- Fitbod (WearOS, 403, citado via resultado de busca): https://help.fitbod.me/hc/en-us/articles/4406074415383-WearOS-on-Android
- Boostcamp: https://www.boostcamp.app/workout-tracker
- StrongLifts: https://stronglifts.com/app/
- StrongLifts: https://support.stronglifts.com/article/70-sets-reps
- StrongLifts: https://support.stronglifts.com/article/111-apple-watch
- Liftosaur: https://www.liftosaur.com/features/workout-screen
- Liftosaur: https://www.liftosaur.com/blog/posts/liftosaur-overview/

**Tooltips, ajuda e acessibilidade**
- NN/g, Tooltip Guidelines: https://www.nngroup.com/articles/tooltip-guidelines/
- NN/g, Mobile Instructional Overlays: https://www.nngroup.com/articles/mobile-instructional-overlay/
- Apple HIG, Offering help: https://developer.apple.com/design/human-interface-guidelines/offering-help
- Apple HIG, Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Android Developers (Material 3), Tooltip: https://developer.android.com/develop/ui/compose/components/tooltip
- Material 3, Tooltips (não renderizou para leitura): https://m3.material.io/components/tooltips/guidelines
- Inclusive Components, Tooltips & Toggletips: https://inclusive-components.design/tooltips-toggletips/
- WCAG 2.2, 1.4.13 Content on Hover or Focus: https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html
- WCAG 2.2, 2.5.3 Label in Name: https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html
- WCAG 2.2, 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WAI-ARIA APG, Tooltip: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
- WAI-ARIA APG, Button: https://www.w3.org/WAI/ARIA/apg/patterns/button/

**Redação de rótulos**
- NN/g, OK–Cancel or Cancel–OK?: https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/
- Microsoft, Buttons (Windows apps): https://learn.microsoft.com/en-us/windows/apps/design/controls/buttons
- Microsoft Writing Style Guide, Describing interactions with UI: https://learn.microsoft.com/en-us/style-guide/procedures-instructions/describing-interactions-with-ui
- Shopify Polaris, Button (docs arquivadas v2.7.0): https://unpkg.com/@shopify/polaris@2.7.0/docs/components/Button/README.md
- Shopify, App design guidelines, Content: https://shopify.dev/apps/design-guidelines/content
- Mailchimp Content Style Guide, TL;DR: https://styleguide.mailchimp.com/tldr/
