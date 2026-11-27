# Roadmap

What is built, what comes next and in what order. The curriculum itself, every cluster and what it needs, is in `graph/`.

## Lessons

140 lessons are written, covering 14 of the 54 clusters. Learn walks them in this order: M0, E0, M1, M2, E1, M3, M10, M4, E3, M5, E5, M12, E6, M7.

The next cluster is M6, abstract vector spaces. With M7 written, it is the last thing M8, spectral theory, is waiting for.

## Mini-capstones

Built. A mini-capstone closes one cluster. It is one small project in stages that needs several of the cluster's lessons at once, and it teaches nothing new. Learn gives it straight after the lesson that finishes the cluster, before the next lesson. A mini-capstone written for a cluster the learner has already passed does not interrupt the lessons; it waits until no lesson is open.

| Cluster | Mini-capstone |
| --- | --- |
| M0 Arithmetic and number sense | Will the photographs fit? |
| E0 First steps in programming | A marks ledger |
| M1 Algebra | Pricing a chai stall |
| M2 Functions and notation | A recurring deposit |
| E1 Python proper | A bank statement reader |
| M3 Logic and proof | Evidence is not proof |
| M10 Single-variable calculus | The cheapest tin |
| M4 Vectors and geometry | Which film next? |
| E3 Data structures and algorithms | A metro route planner |
| M5 Matrices and linear maps | The transform tool |
| E5 NumPy and numerical computing | Rent by neighbours, without a loop |
| M12 Multivariable calculus | An arm that reaches |
| E6 Autograd from scratch | Water near the well, from an empty file |
| M7 Orthogonality and least squares | A thermometer you can trust |

Every written cluster now has one. From here on, every new cluster ships with its mini-capstone in the same batch as its lessons.

## Recall and timing

Built. The Recall part of every lesson is one set of exactly three questions on earlier ideas, chosen by the FSRS-4.5 memory model, each a question the learner has never seen, written and independently checked for that one occasion. System One questions are timed and System Two questions are not. Mastery weighs accuracy, tutor hints, speed and recency, and a weak finish holds the lesson open for a consolidation set of three fresh questions. How these work is in the README.

Not built yet: mastery that weighs speed, hints and recency, with a short consolidation set after a weak finish; and the Map does not show how well each lesson is remembered.

## Capstones

Not built. A capstone is a larger project that spans several clusters and usually more than one track. Unlike a mini-capstone, it ends in something the learner keeps: a working program and a short written account of it.

Proposed places, each at a point where tracks meet:

| After | Capstone | Can be written |
| --- | --- | --- |
| M5, E3, E5 | A small linear algebra library, written from scratch and checked against NumPy | Now: every cluster it needs is written |
| L2 Linear models | Linear and logistic regression from scratch on a real dataset, with a proper evaluation | After M7, M12, M14, M18, L1 and L2 |
| L5 and E6 | A neural network trained with an autograd engine the learner wrote | After M13, E6 and L5 |
| L7 and E8 | A small transformer language model, trained and sampled from | After L6, L7, E7 and E8 |
| L12 and later | A reproduction of a published result, with its evaluation | After L8 and L12 |

What it needs beyond the mini-capstone machinery:

- Work that carries across stages and sessions as one project, instead of one editor per question.
- A way to judge open-ended work: hidden tests where they fit, and a rubric the tutor applies to the written account.
- A page that keeps finished capstones, since they are what job-readiness draws on.

## Job-readiness

Not built, and it comes last: it rests on the capstones, which are the evidence, and on the machine learning track, which has no lessons yet.

Proposed contents, to be confirmed before any of it is built:

- A portfolio page of finished capstones, each with its code and written account.
- A skills checklist computed from finished clusters and capstones, set against the usual requirements for machine learning engineering and research engineering roles.
- Interview practice drawn from the curriculum: coding questions from E3, mathematics and machine learning questions from the M and L tracks, and system design from E12 to E15, with the tutor as interviewer.

It should start once the first two capstones exist, so that there is something to put in the portfolio.
