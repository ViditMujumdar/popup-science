/** Hand-authored example pop-ups (no AI needed). They go through the same sanitizer as AI output. */
import { sanitizeExplanation, type Explanation } from './scene';

type O = Record<string, unknown>;
const o = (kind: string, rest: O): O => ({ part: null, label: null, position: [0, 0, 0], color: '#4fe3f0', ...rest, kind });

// ---------------------------------------------------------------- Convex lens
const lens: O = {
  title: 'Image formed by a convex lens (object at 2F)',
  grade: 10, subject: 'physics', topic: 'Refraction of light: convex lens', gradeLevel: 'Class 10',
  summary: 'A candle placed at 2F in front of a convex lens forms a real, inverted image of the same size at 2F on the other side.',
  descriptionMarkdown: `A **convex lens** is thicker in the middle. It bends (refracts) light rays towards the **principal axis**, so parallel rays meet at the **principal focus F₂**.

To find the image of the candle flame, we follow three easy rays from its tip:

- **Ray 1** travels parallel to the principal axis, and after the lens passes **through F₂**.
- **Ray 2** passes through the **optical centre O** and goes straight on without bending.
- **Ray 3** passes through **F₁**, and after the lens comes out **parallel** to the axis.

All three rays meet at one point. That point is the tip of the **image**.

When the object is at **2F₁**, the image forms at **2F₂** and is:

- **real** (it can be caught on a screen),
- **inverted** (upside down),
- **the same size** as the object (magnification m = −1).

Lens formula: 1/f = 1/v − 1/u, with u = −2f gives v = +2f.`,
  parts: [
    { id: 'object', name: 'Object (candle)', description: 'The candle is placed at 2F₁, twice the focal length in front of the lens.' },
    { id: 'lens', name: 'Convex lens', description: 'A converging lens. It bends rays towards the principal axis.' },
    { id: 'axis', name: 'Principal axis', description: 'The straight line through the optical centre O and both foci.' },
    { id: 'focus', name: 'Foci F and 2F', description: 'F₁, F₂ are the principal foci; 2F₁, 2F₂ are at twice the focal length.' },
    { id: 'rays', name: 'Light rays', description: 'Three standard rays from the tip of the flame used to locate the image.' },
    { id: 'image', name: 'Real, inverted image', description: 'Formed at 2F₂ on the screen; inverted and the same size as the object.' },
  ],
  steps: [
    { title: 'Ray parallel to the axis', text: 'A ray from the flame travels parallel to the principal axis. The lens bends it so that it passes through the focus F₂.', focus: ['rays', 'focus'] },
    { title: 'Ray through the optical centre', text: 'A ray through the optical centre O goes straight through the lens without bending.', focus: ['rays', 'lens'] },
    { title: 'Ray through F₁', text: 'A ray through F₁ leaves the lens parallel to the principal axis.', focus: ['rays', 'focus'] },
    { title: 'The image forms at 2F₂', text: 'The three rays meet at 2F₂. A screen there shows a real, inverted image, the same size as the candle.', focus: ['image'] },
  ],
  keyTerms: [
    { term: 'Refraction', meaning: 'Bending of light when it passes from one medium into another.' },
    { term: 'Principal focus', meaning: 'Point where rays parallel to the axis meet after passing through a convex lens.' },
    { term: 'Real image', meaning: 'An image formed where rays actually meet; it can be caught on a screen.' },
    { term: 'Magnification', meaning: 'Image height divided by object height (m = −1 here).' },
  ],
  funFact: 'Your eye has a convex lens too: the image on your retina is upside down, and your brain flips it.',
  videoQuery: 'convex lens ray diagram object at 2F class 10',
  warnings: [],
  objects: [
    o('box', { part: null, position: [0, -2.15, 0], size: [11.5, 0.14, 1.4], color: '#2a3142' }),
    o('line', { part: 'axis', label: 'Principal axis', points: [-5.6, 0, 0, 5.6, 0, 0], color: '#9aa3b2' }),
    // lens
    o('sphere', { part: 'lens', label: 'Convex lens', position: [0, 0, 0], size: [0.24, 1.9, 1.9], color: '#9fe8ff', opacity: 0.35 }),
    o('torus', { part: 'lens', position: [0, 0, 0], rotation: [0, 90, 0], size: [1.9, 0.04], color: '#cfefff' }),
    o('cylinder', { part: 'lens', position: [0, -2.0, 0], size: [0.07, 0.25], color: '#c9d1dc' }),
    o('sphere', { part: 'axis', label: 'O', position: [0, 0, 0], size: [0.07], color: '#f4f1e8', glow: true }),
    // foci
    o('sphere', { part: 'focus', label: 'F₁', position: [-2, 0, 0], size: [0.09], color: '#ff9a3c', glow: true }),
    o('sphere', { part: 'focus', label: 'F₂', position: [2, 0, 0], size: [0.09], color: '#ff9a3c', glow: true }),
    o('sphere', { part: 'focus', label: '2F₁', position: [-4, 0, 0], size: [0.07], color: '#a974ff', glow: true }),
    o('sphere', { part: 'focus', label: '2F₂', position: [4, 0, 0], size: [0.07], color: '#a974ff', glow: true }),
    // object candle at 2F1
    o('cylinder', { part: 'object', label: 'Candle (object)', position: [-4, 0.45, 0], size: [0.17, 0.9], color: '#f4f1e8' }),
    o('sphere', { part: 'object', position: [-4, 1.08, 0], size: [0.09, 0.16, 0.09], color: '#ffb03b', glow: true, animation: 'pulse', speed: 1.4 }),
    o('cylinder', { part: 'object', position: [-4, -0.95, 0], size: [0.07, 1.9], color: '#c9d1dc' }),
    // rays (appear step by step)
    o('line', { part: 'rays', points: [-4, 1.2, 0, 0, 1.2, 0, 2, 0, 0, 5, -1.8, 0], color: '#ffd23f', step: 1, animation: 'flow', speed: 1 }),
    o('line', { part: 'rays', points: [-4, 1.2, 0, 0, 0, 0, 5, -1.5, 0], color: '#3ddc84', step: 2, animation: 'flow', speed: 1 }),
    o('line', { part: 'rays', points: [-4, 1.2, 0, -2, 0, 0, 0, -1.2, 0, 5, -1.2, 0], color: '#ff6fb5', step: 3, animation: 'flow', speed: 1 }),
    // image + screen at 2F2
    o('box', { part: 'image', label: 'Screen', position: [4.08, -0.35, 0], size: [0.05, 2.9, 2.2], color: '#f4f1e8', opacity: 0.22, step: 4 }),
    o('cylinder', { part: 'image', label: 'Image (real, inverted)', position: [4, -0.45, 0], size: [0.17, 0.9], color: '#f4f1e8', opacity: 0.75, step: 4 }),
    o('sphere', { part: 'image', position: [4, -1.08, 0], size: [0.09, 0.16, 0.09], color: '#ffb03b', glow: true, step: 4, animation: 'pulse', speed: 1.4 }),
  ],
};

// ---------------------------------------------------------------- Bohr atom
const nucleus: O[] = [];
for (let i = 0; i < 12; i++) {
  const y = 1 - (i / 11) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
  const p = [Math.cos(th) * r * 0.32, y * 0.32, Math.sin(th) * r * 0.32].map((n) => Math.round(n * 1000) / 1000);
  nucleus.push(o('sphere', { part: i % 2 ? 'neutron' : 'proton', position: p, size: [0.2], color: i % 2 ? '#9aa3b2' : '#ff5a5a', label: i === 0 ? 'Nucleus (6p⁺, 6n)' : null }));
}
const atom: O = {
  title: 'Bohr model of a carbon atom',
  grade: 9, subject: 'chemistry', topic: 'Structure of the atom', gradeLevel: 'Class 9',
  summary: 'A carbon atom has 6 protons and 6 neutrons in its nucleus and 6 electrons arranged in two shells: 2 in K and 4 in L.',
  descriptionMarkdown: `In **Bohr's model**, an atom has a tiny, heavy, positively charged **nucleus** at the centre. Electrons move around it in fixed circular paths called **shells** or **energy levels** (K, L, M, …).

For **carbon (atomic number 6)**:

- The nucleus holds **6 protons** (positive) and **6 neutrons** (no charge). Mass number = 6 + 6 = 12.
- **6 electrons** (negative) balance the 6 protons, so the atom is neutral.
- Electronic configuration **2, 4**: the K shell holds at most 2 electrons, so the remaining 4 go into the L shell.

While an electron stays in its shell it does not lose energy. It can jump to a higher shell only by absorbing an exact amount of energy.

The **4 outer (valence) electrons** explain why carbon forms 4 covalent bonds, as in methane, CH₄.

Modern quantum mechanics replaces the neat circles with an **electron cloud**: regions where an electron is most likely to be found.`,
  parts: [
    { id: 'proton', name: 'Protons', description: 'Positively charged particles in the nucleus. Carbon has 6.' },
    { id: 'neutron', name: 'Neutrons', description: 'Neutral particles in the nucleus. Carbon-12 has 6.' },
    { id: 'k-shell', name: 'K shell (n = 1)', description: 'The innermost shell. It holds at most 2 electrons.' },
    { id: 'l-shell', name: 'L shell (n = 2)', description: 'The second shell. Carbon has 4 valence electrons here.' },
    { id: 'cloud', name: 'Electron cloud', description: 'The modern picture: where electrons are likely to be found.' },
  ],
  steps: [
    { title: 'The nucleus', text: '6 protons and 6 neutrons are packed into a tiny nucleus that holds almost all of the mass.', focus: ['proton', 'neutron'] },
    { title: 'K shell: 2 electrons', text: 'The first shell is full with 2 electrons.', focus: ['k-shell'] },
    { title: 'L shell: 4 electrons', text: 'The remaining 4 electrons go into the L shell. These valence electrons take part in bonding.', focus: ['l-shell'] },
    { title: 'Modern view: electron cloud', text: 'Electrons do not follow exact circles; quantum mechanics describes a cloud of probability.', focus: ['cloud'] },
  ],
  keyTerms: [
    { term: 'Atomic number (Z)', meaning: 'Number of protons; 6 for carbon.' },
    { term: 'Mass number (A)', meaning: 'Protons + neutrons; 12 for carbon-12.' },
    { term: 'Valence electrons', meaning: 'Electrons in the outermost shell; they decide bonding.' },
    { term: 'Energy level', meaning: 'A fixed shell where an electron can stay without losing energy.' },
  ],
  funFact: 'If an atom were the size of a cricket stadium, its nucleus would be about the size of a marble at the centre.',
  videoQuery: 'Bohr model of atom carbon electronic configuration class 9',
  warnings: [],
  objects: [
    ...nucleus,
    o('torus', { part: 'k-shell', label: 'K shell', rotation: [90, 0, 0], size: [1.5, 0.018], color: '#4fe3f0', opacity: 0.6, step: 2 }),
    o('torus', { part: 'l-shell', label: 'L shell', rotation: [90, 0, 0], size: [2.9, 0.018], color: '#a974ff', opacity: 0.6, step: 3 }),
    ...[[1.5, 0, 0], [-1.5, 0, 0]].map((p) => o('sphere', { part: 'k-shell', position: p, size: [0.12], color: '#ffd23f', glow: true, step: 2, animation: 'orbit', axis: 'y', center: [0, 0, 0], speed: 1.2 })),
    ...[[2.9, 0, 0], [0, 0, 2.9], [-2.9, 0, 0], [0, 0, -2.9]].map((p, i) => o('sphere', { part: 'l-shell', label: i === 0 ? 'Electron (e⁻)' : null, position: p, size: [0.12], color: '#ffd23f', glow: true, step: 3, animation: 'orbit', axis: 'y', center: [0, 0, 0], speed: 0.6 })),
    o('particles', { part: 'cloud', label: 'Electron cloud', position: [0, 0, 0], size: [3.4, 3.4, 3.4], count: 260, color: '#4f8cff', opacity: 0.5, step: 4, animation: 'jitter' }),
  ],
};

// ---------------------------------------------------------------- Circuit
const circuit: O = {
  title: 'A simple electric circuit',
  grade: 10, subject: 'physics', topic: 'Electricity: current, potential difference and resistance', gradeLevel: 'Class 10',
  summary: 'A cell drives an electric current through a resistor and a bulb connected in series by copper wires.',
  descriptionMarkdown: `An **electric circuit** is a closed path for electric charge.

- The **cell** keeps a **potential difference (V)** between its terminals. It pushes charge around the circuit.
- **Conventional current (I)** flows from the **+ terminal**, through the outside circuit, back to the **− terminal**. Electrons actually drift the opposite way.
- The **resistor** opposes the current. Its resistance R is measured in ohms (Ω).
- The **bulb's filament** has resistance too. It heats up and glows.

All the parts are in **series**, so the **same current** flows through each one. By **Ohm's law**:

I = V / (R_resistor + R_bulb)

If any part of the loop is broken (for example, a switch is opened), the current stops everywhere and the bulb goes out.`,
  parts: [
    { id: 'cell', name: 'Cell', description: 'Source of potential difference. The longer plate in the symbol is the + terminal.' },
    { id: 'wires', name: 'Connecting wires', description: 'Copper wires with very low resistance that complete the loop.' },
    { id: 'resistor', name: 'Resistor (R)', description: 'Limits the current. The coloured bands encode its resistance.' },
    { id: 'bulb', name: 'Bulb', description: 'Its thin tungsten filament gets hot and glows when current flows.' },
    { id: 'current', name: 'Current direction', description: 'Conventional current goes from + to − through the external circuit.' },
  ],
  steps: [
    { title: 'The cell creates a push', text: 'The chemical reaction in the cell keeps one terminal at a higher potential: this is the potential difference V.', focus: ['cell'] },
    { title: 'Current flows around the loop', text: 'Charge flows from + through the wires, the bulb and the resistor, back to −. The same current I flows everywhere in a series circuit.', focus: ['current', 'wires'] },
    { title: 'Resistance controls the current', text: 'The resistor and the filament oppose the flow. By Ohm’s law, I = V/R_total.', focus: ['resistor'] },
    { title: 'Energy becomes light', text: 'In the bulb, electrical energy turns into heat and light, so the filament glows.', focus: ['bulb'] },
  ],
  keyTerms: [
    { term: 'Electric current', meaning: 'Rate of flow of charge, I = Q/t, measured in amperes (A).' },
    { term: 'Potential difference', meaning: 'Work done per unit charge, V = W/Q, in volts (V).' },
    { term: 'Resistance', meaning: 'Opposition to current, R = V/I, in ohms (Ω).' },
    { term: 'Series circuit', meaning: 'Components in a single loop, so the same current flows through each one.' },
  ],
  funFact: 'Electrons drift through a copper wire at less than 1 mm per second, yet a bulb lights instantly because the push travels at almost the speed of light.',
  videoQuery: 'simple electric circuit current potential difference Ohm law class 10',
  warnings: [],
  objects: [
    o('box', { position: [0, -2.3, 0], size: [8.2, 0.14, 3], color: '#1f2a3b' }),
    // cell lying along x at the bottom edge
    o('cylinder', { part: 'cell', label: 'Cell (+ −)', position: [0.25, -1.5, 0], rotation: [0, 0, 90], size: [0.42, 1.5], color: '#2b2f3a' }),
    o('cylinder', { part: 'cell', position: [0.75, -1.5, 0], rotation: [0, 0, 90], size: [0.43, 0.5], color: '#e08a4f' }),
    o('cylinder', { part: 'cell', position: [1.08, -1.5, 0], rotation: [0, 0, 90], size: [0.16, 0.16], color: '#c9d1dc' }),
    o('label', { part: 'cell', label: '+', position: [1.3, -1.05, 0], color: '#ff5a5a' }),
    o('label', { part: 'cell', label: '−', position: [-0.65, -1.05, 0], color: '#4f8cff' }),
    // wires
    o('tube', { part: 'wires', label: 'Copper wire', points: [1.16, -1.5, 0, 3, -1.5, 0, 3, 1.5, 0, 0.3, 1.5, 0], size: [0.05], color: '#e08a4f', animation: 'flow', speed: 1 }),
    o('tube', { part: 'wires', points: [-0.3, 1.5, 0, -3, 1.5, 0, -3, -1.5, 0, -0.5, -1.5, 0], size: [0.05], color: '#e08a4f', animation: 'flow', speed: 1 }),
    // resistor on left edge
    o('cylinder', { part: 'resistor', label: 'Resistor R', position: [-3, 0, 0], size: [0.24, 1.2], color: '#d9b98c' }),
    o('cylinder', { part: 'resistor', position: [-3, 0.35, 0], size: [0.25, 0.1], color: '#b07a4f' }),
    o('cylinder', { part: 'resistor', position: [-3, 0.1, 0], size: [0.25, 0.1], color: '#3a3f4b' }),
    o('cylinder', { part: 'resistor', position: [-3, -0.15, 0], size: [0.25, 0.1], color: '#ff5a5a' }),
    o('cylinder', { part: 'resistor', position: [-3, -0.4, 0], size: [0.25, 0.1], color: '#ffc857' }),
    // bulb on top
    o('cylinder', { part: 'bulb', position: [0, 1.6, 0], size: [0.24, 0.4], color: '#c9d1dc' }),
    o('sphere', { part: 'bulb', label: 'Bulb', position: [0, 2.25, 0], size: [0.55], color: '#fff3b0', opacity: 0.3, glow: true, animation: 'pulse', speed: 0.6 }),
    o('helix', { part: 'bulb', position: [0, 2.25, 0], rotation: [0, 0, 90], size: [0.07, 0.42, 6], color: '#ffd23f', glow: true }),
    // current arrows (step 2)
    o('arrow', { part: 'current', label: 'Current I', points: [3.55, -0.7, 0, 3.55, 0.7, 0], size: [0.05], color: '#4fe3f0', step: 2 }),
    o('arrow', { part: 'current', points: [-3.55, 0.7, 0, -3.55, -0.7, 0], size: [0.05], color: '#4fe3f0', step: 2 }),
    o('arrow', { part: 'current', points: [1.4, 1.95, 0, -0.9, 1.95, 0], size: [0.05], color: '#4fe3f0', step: 2 }),
  ],
};

// ---------------------------------------------------------------- DNA
const dna: O = {
  title: 'DNA double helix',
  grade: 12, subject: 'biology', topic: 'Molecular basis of inheritance', gradeLevel: 'Class 12',
  summary: 'DNA is two strands twisted into a double helix. Sugar-phosphate backbones are on the outside and paired bases (A–T, G–C) are on the inside.',
  descriptionMarkdown: `**DNA (deoxyribonucleic acid)** carries the genetic information of almost all living things. Its structure was described by **Watson and Crick (1953)** using X-ray images by **Rosalind Franklin**.

- It has **two strands** that wind around each other as a right-handed **double helix**.
- Each strand has a **backbone** of alternating **deoxyribose sugar** and **phosphate** groups.
- The strands are **antiparallel**: one runs 5′→3′ and the other 3′→5′.
- **Nitrogenous bases** point inwards and pair up by **hydrogen bonds**:
  - **Adenine (A) = Thymine (T)**: 2 hydrogen bonds
  - **Guanine (G) ≡ Cytosine (C)**: 3 hydrogen bonds
- This **complementary base pairing** is why the amount of A equals T and G equals C (**Chargaff's rule**). It also lets each strand act as a template when DNA copies itself.

One full turn is about **3.4 nm** long and contains about **10 base pairs**. The width of the helix is about **2 nm**.`,
  parts: [
    { id: 'backbone', name: 'Sugar-phosphate backbone', description: 'Alternating deoxyribose sugar and phosphate groups form the outside of each strand.' },
    { id: 'bases', name: 'Base pairs', description: 'A pairs with T and G pairs with C, joined by hydrogen bonds.' },
    { id: 'legend', name: 'Nitrogenous bases', description: 'Adenine, thymine, guanine and cytosine.' },
  ],
  steps: [
    { title: 'Two twisted strands', text: 'Two backbones of sugar and phosphate wind around a common axis into a right-handed double helix.', focus: ['backbone'] },
    { title: 'Bases pair in the middle', text: 'Bases point inward and pair by hydrogen bonds: A with T (2 bonds) and G with C (3 bonds).', focus: ['bases', 'legend'] },
    { title: 'Why pairing matters', text: 'Because pairing is complementary, each strand can be used to rebuild the other. This is how DNA is copied before cell division.', focus: ['bases'] },
  ],
  keyTerms: [
    { term: 'Nucleotide', meaning: 'The unit of DNA: a sugar, a phosphate and one base.' },
    { term: 'Complementary pairing', meaning: 'A always pairs with T, and G with C.' },
    { term: 'Antiparallel', meaning: 'The two strands run in opposite directions (5′→3′ and 3′→5′).' },
  ],
  funFact: 'If you stretched out all the DNA in one human cell it would be about 2 metres long.',
  videoQuery: 'DNA double helix structure base pairing class 12 biology',
  warnings: [],
  objects: [
    o('helix', { part: 'backbone', label: 'Sugar-phosphate backbone', position: [0, 0, 0], size: [1.1, 7.6, 2.6], color: '#4fe3f0', double: true, animation: 'spin', axis: 'y', speed: 0.35 }),
    o('label', { part: 'bases', label: 'Base pairs (A–T, G–C)', position: [0, 0.2, 0], color: '#f4f1e8', step: 2 }),
    o('sphere', { part: 'legend', label: 'Adenine (A)', position: [3.4, 1.5, 0], size: [0.18], color: '#ff5a5a', glow: true, step: 2 }),
    o('sphere', { part: 'legend', label: 'Thymine (T)', position: [3.4, 0.7, 0], size: [0.18], color: '#ffd23f', glow: true, step: 2 }),
    o('sphere', { part: 'legend', label: 'Guanine (G)', position: [3.4, -0.1, 0], size: [0.18], color: '#3ddc84', glow: true, step: 2 }),
    o('sphere', { part: 'legend', label: 'Cytosine (C)', position: [3.4, -0.9, 0], size: [0.18], color: '#4f8cff', glow: true, step: 2 }),
    o('arrow', { part: 'backbone', label: '5′ → 3′', points: [-2.4, 3, 0, -2.4, -3, 0], size: [0.04], color: '#a974ff', step: 3 }),
    o('arrow', { part: 'backbone', label: '3′ → 5′', points: [-2.9, -3, 0, -2.9, 3, 0], size: [0.04], color: '#ff6fb5', step: 3 }),
  ],
};


// ---------------------------------------------------------------- Class 4 fractions (homework)
const choc: O[] = [];
const piece = (i: number) => [(i % 4) - 1.5, 0, i < 4 ? -0.5 : 0.5];
for (let i = 0; i < 8; i++) choc.push(o('box', { part: 'bar', position: piece(i), size: [0.92, 0.32, 0.92], color: '#7b4a2a', label: i === 0 ? '1 bar = 8 pieces' : null }));
const cover = (idx: number[], part: string, color: string, step: number, label: string, glow = false) =>
  idx.map((i, k) => o('box', { part, position: [piece(i)[0], 0.02, piece(i)[2]], size: [0.98, 0.4, 0.98], color, opacity: 0.6, glow, step, label: k === 0 ? label : null, animation: glow ? 'pulse' : 'none', speed: 0.8 }));
const fractions: O = {
  title: 'Adding and subtracting fractions', grade: 4,
  subject: 'mathematics', topic: 'Fractions', gradeLevel: 'Class 4',
  summary: 'Riya and Aman share a chocolate bar. We find how much is left by making the fractions have the same number of pieces.',
  descriptionMarkdown: `A **fraction** tells us how many equal pieces we have out of the whole.

- In **3/8**, the bottom number (**8**) says the bar is cut into 8 equal pieces. The top number (**3**) says we take 3 of them.
- To add or subtract fractions, the pieces must be the **same size**. So we change **1/4** into eighths: 1/4 = 2/8 (multiply the top and the bottom by 2).
- The whole bar is **8/8 = 1**.

So: eaten = 3/8 + 2/8 = 5/8, and left = 8/8 − 5/8 = **3/8**.`,
  homework: {
    question: 'Riya ate 3/8 of a chocolate bar and Aman ate 1/4 of it. What fraction of the chocolate bar is left?',
    hints: [
      'The bar has 8 equal pieces. Can you write Aman’s 1/4 as eighths?',
      '1/4 = 2/8. Now add the pieces that were eaten: 3/8 + 2/8.',
      'The whole bar is 8/8. Take away the eaten part.',
    ],
    answerMarkdown: 'Aman ate 1/4 = 2/8.\n\nEaten = 3/8 + 2/8 = 5/8\n\nLeft = 8/8 − 5/8 = **3/8 of the chocolate bar**.',
    checks: [{ label: 'Fraction left', expression: '1 - (3/8 + 1/4)', claimed: 0.375 }],
    practice: [
      { question: 'A pizza has 6 slices. Sam eats 1/3 of it and Tia eats 1/6. What fraction is left?', answer: '1/3 = 2/6. Eaten = 2/6 + 1/6 = 3/6. Left = 3/6 = 1/2.' },
      { question: 'Mohan walked 2/5 km and then 1/10 km. How far did he walk in all?', answer: '2/5 = 4/10. 4/10 + 1/10 = 5/10 = 1/2 km.' },
    ],
  },
  parts: [
    { id: 'bar', name: 'Whole chocolate bar', description: '8 equal pieces, so each piece is 1/8 of the bar.' },
    { id: 'riya', name: 'Riya’s share (3/8)', description: '3 of the 8 pieces.' },
    { id: 'aman', name: 'Aman’s share (1/4 = 2/8)', description: 'One quarter of the bar is 2 of the 8 pieces.' },
    { id: 'left', name: 'Left over (3/8)', description: 'The 3 pieces nobody ate.' },
  ],
  steps: [
    { title: 'Riya’s share', text: '3/8 means 3 of the 8 equal pieces.', focus: ['riya', 'bar'] },
    { title: 'Make quarters into eighths', text: '1/4 = 2/8 (multiply top and bottom by 2), so Aman ate 2 pieces.', focus: ['aman'] },
    { title: 'Add what was eaten', text: '3/8 + 2/8 = 5/8 of the bar was eaten.', focus: ['riya', 'aman'] },
    { title: 'Find what is left', text: '8/8 − 5/8 = 3/8 of the bar is left.', focus: ['left'] },
  ],
  keyTerms: [
    { term: 'Numerator', meaning: 'The top number: how many pieces we take.' },
    { term: 'Denominator', meaning: 'The bottom number: how many equal pieces the whole is cut into.' },
    { term: 'Equivalent fractions', meaning: 'Fractions that show the same amount, like 1/4 and 2/8.' },
  ],
  funFact: 'The word “fraction” comes from the Latin word “fractus”, which means “broken”.',
  videoQuery: 'adding and subtracting fractions with different denominators class 4',
  warnings: [],
  objects: [
    o('box', { position: [0, -0.3, 0], size: [4.4, 0.1, 2.4], color: '#c9d1dc' }),
    ...choc,
    ...cover([0, 1, 2], 'riya', '#ff6fb5', 1, 'Riya: 3/8'),
    ...cover([4, 5], 'aman', '#4f8cff', 2, 'Aman: 1/4 = 2/8'),
    o('label', { part: 'bar', label: 'Eaten: 3/8 + 2/8 = 5/8', position: [0, 1.3, 0], color: '#f4f1e8', step: 3 }),
    ...cover([3, 6, 7], 'left', '#b8f03a', 4, 'Left: 3/8'),
  ],
};

// ---------------------------------------------------------------- Class 8 volume of a cuboid (homework)
const cubes: O[] = [];
for (let y = 0; y < 2; y++) for (let z = 0; z < 3; z++) for (let x = 0; x < 5; x++)
  cubes.push(o('box', { part: y === 0 ? 'layer1' : 'layer2', position: [x - 2, y - 0.5, z - 1], size: [0.9, 0.9, 0.9], color: y === 0 ? '#4fe3f0' : '#a974ff', step: y + 1, label: x === 4 && z === 2 ? (y === 0 ? 'Layer 1: 5 × 3 = 15' : 'Layer 2: 15 more') : null }));
const cuboid: O = {
  title: 'Volume and surface area of a cuboid', grade: 8,
  subject: 'mathematics', topic: 'Mensuration', gradeLevel: 'Class 8',
  summary: 'A 5 cm × 3 cm × 2 cm box is filled with 1 cm cubes to see why volume = l × b × h, then its 6 faces are added up for the surface area.',
  descriptionMarkdown: `**Volume** is the space a solid takes up. We measure it in **cubic units** (cm³), and each one is a 1 cm × 1 cm × 1 cm cube.

- One layer on the base holds **l × b** cubes.
- There are **h** layers, so **Volume = l × b × h**.

**Total surface area (TSA)** is the area of all **6 faces**. Opposite faces are equal:

- top & bottom: 2 × (l × b)
- front & back: 2 × (l × h)
- left & right: 2 × (b × h)

So **TSA = 2(lb + bh + hl)**. Common mistake: volume is in cm³, but area is in cm².`,
  homework: {
    question: 'A box is 5 cm long, 3 cm wide and 2 cm high. Find (a) its volume and (b) its total surface area.',
    hints: [
      'Imagine filling the box with 1 cm cubes. How many fit on the bottom layer?',
      'Volume = l × b × h. For surface area, add the areas of all 6 faces.',
      'TSA = 2(lb + bh + hl). Put l = 5, b = 3, h = 2.',
    ],
    answerMarkdown: '(a) Volume = l × b × h = 5 × 3 × 2 = **30 cm³**\n\n(b) TSA = 2(lb + bh + hl) = 2(5×3 + 3×2 + 2×5) = 2(15 + 6 + 10) = 2 × 31 = **62 cm²**',
    checks: [
      { label: 'Volume (cm³)', expression: '5*3*2', claimed: 30 },
      { label: 'Total surface area (cm²)', expression: '2*(5*3 + 3*2 + 2*5)', claimed: 62 },
    ],
    practice: [
      { question: 'A cuboid is 4 cm × 4 cm × 3 cm. Find its volume.', answer: '4 × 4 × 3 = 48 cm³' },
      { question: 'Find the total surface area of a cube with side 5 cm.', answer: 'TSA of a cube = 6a² = 6 × 25 = 150 cm²' },
    ],
  },
  parts: [
    { id: 'box', name: 'The cuboid (5 × 3 × 2 cm)', description: 'Length 5 cm, breadth 3 cm, height 2 cm.' },
    { id: 'layer1', name: 'Bottom layer', description: '5 × 3 = 15 unit cubes.' },
    { id: 'layer2', name: 'Top layer', description: 'Another 15 unit cubes, so 30 in total.' },
    { id: 'faces', name: '6 faces', description: 'Their total area is the surface area.' },
  ],
  steps: [
    { title: 'Fill one layer', text: 'The bottom layer holds l × b = 5 × 3 = 15 unit cubes.', focus: ['layer1'] },
    { title: 'Stack the layers', text: 'h = 2 layers, so the volume is 15 × 2 = 30 cm³ (that is l × b × h).', focus: ['layer1', 'layer2'] },
    { title: 'Add the 6 faces', text: 'TSA = 2(lb + bh + hl) = 2(15 + 6 + 10) = 62 cm².', focus: ['faces'] },
  ],
  keyTerms: [
    { term: 'Volume', meaning: 'Space inside a solid, in cubic units (cm³).' },
    { term: 'Surface area', meaning: 'Total area of all the faces, in square units (cm²).' },
    { term: 'Cuboid', meaning: 'A box shape with 6 rectangular faces.' },
  ],
  funFact: 'A standard brick (about 19 × 9 × 9 cm) has a volume of roughly 1,539 cm³.',
  videoQuery: 'volume and surface area of cuboid class 8 mensuration',
  warnings: [],
  objects: [
    o('box', { part: 'box', label: 'l = 5, b = 3, h = 2 (cm)', position: [0, 0, 0], size: [5, 2, 3], color: '#f4f1e8', opacity: 0.12 }),
    o('arrow', { part: 'box', label: 'l = 5 cm', points: [-2.5, -1.35, 1.9, 2.5, -1.35, 1.9], size: [0.04], color: '#ffd23f' }),
    o('arrow', { part: 'box', label: 'b = 3 cm', points: [2.9, -1.35, 1.5, 2.9, -1.35, -1.5], size: [0.04], color: '#ffd23f' }),
    o('arrow', { part: 'box', label: 'h = 2 cm', points: [-2.95, -1, 1.6, -2.95, 1, 1.6], size: [0.04], color: '#ffd23f' }),
    ...cubes,
    o('box', { part: 'faces', label: '6 faces → 62 cm²', position: [0, 0, 0], size: [5.15, 2.15, 3.15], color: '#ff6fb5', opacity: 0.14, step: 3 }),
  ],
};

const RAW: Record<string, O> = { fractions, lens, atom, cuboid, circuit, dna };
export const EXAMPLE_IDS = Object.keys(RAW);
export const EXAMPLE_META: Record<string, { emoji: string; subject: string; short: string }> = {
  fractions: { emoji: '🍫', subject: 'Maths · Class 4', short: 'Fractions' },
  lens: { emoji: '🔍', subject: 'Physics · Class 10', short: 'Lens' },
  atom: { emoji: '⚛️', subject: 'Chemistry · Class 9', short: 'Atom' },
  cuboid: { emoji: '📦', subject: 'Maths · Class 8', short: 'Volume' },
  circuit: { emoji: '💡', subject: 'Physics · Class 10', short: 'Circuit' },
  dna: { emoji: '🧬', subject: 'Biology · Class 12', short: 'DNA' },
};

export function getExample(id: string): Explanation | null {
  const raw = RAW[id];
  if (!raw) return null;
  const s = sanitizeExplanation(raw);
  if (!s.ok) throw new Error(`example ${id} invalid: ${s.reason}`);
  return s.explanation;
}
