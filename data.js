/**
 * data.js — Données statiques du Business Plan MVP
 * Château Gonflable
 *
 * Chaque section = un onglet. Modifier directement ce fichier pour mettre à jour les données.
 * Types de colonnes : text | price | number | link | bool | badge | rating
 */

const DATA = {

  // ─────────────────────────────────────────────────────────────
  // ONGLET 1 — Investissement initial
  // ─────────────────────────────────────────────────────────────
  chateauGonflable: {
    title: "Château Gonflable",
    subtitle: "Investissement initial — Matériel",
    accentClass: "accent-cyan",
    columns: [
      { key: "produit",     label: "Produit",       type: "text"   },
      { key: "becarefull",  label: "⚠️ BECAREFULL", type: "text"   },
      { key: "qte",         label: "Qté",           type: "number" },
      { key: "prixHT",      label: "Prix HT",       type: "price"  },
      { key: "prixTTC",     label: "Prix TTC",      type: "price"  },
      { key: "commentaire", label: "Commentaire",   type: "text"   },
      { key: "lien",        label: "Lien",          type: "link"   }
    ],
    rows: [
      {
        produit: "Groupe électrogène",
        becarefull: "Techno inverter (bruit) = 64 dB\nAutonomie (+6/8h → prix x2 ou bruyant)",
        qte: 1,
        prixHT: 559.20,
        prixTTC: 699.00,
        commentaire: "Prix affiché TTC sur le site\n6 à 8 heures d'autonomie",
        lien: "https://www.leroymerlin.fr/produits/groupe-electrogene-silencieux-2200w-inverter-moteur-4t-essence-79-cm3-champion-protection-avr-autonomie-10-heures-generateur-85118083.html",
        image: "image/groupe elec.png"
      },
      {
        produit: "Enrouleur (élec)",
        becarefull: "Section 3G2.5 mm² 25m\nIP44 (extérieur)",
        qte: 1,
        prixHT: 55.12,
        prixTTC: 66.14,
        commentaire: "Existe moins cher (~30€) mais pas en simple câble et en 10m",
        lien: "https://www.bricodepot.fr/catalogue/enrouleur-de-chantier-25-m-nf/prod54950/",
        image: "image/enrouleur chantier.png"
      },
      {
        produit: "Jerican",
        becarefull: "Consommation d'un château 10h → 9 à 12 L",
        qte: 1,
        prixHT: 11.12,
        prixTTC: 13.34,
        commentaire: "",
        lien: "https://lp.carter-cash.com/accessoires/p/jerrican-plas20l-21017063",
        image: "image/jerican.png"
      },
      {
        produit: "Plaque anti-vibration",
        becarefull: "",
        qte: 1,
        prixHT: 9.20,
        prixTTC: 11.04,
        commentaire: "Sous le groupe électrogène",
        lien: "https://www.castorama.fr/plaque-anti-vibration-en-caoutchouc-noir-diall/3663602993186_CAFR.prd",
        image: "image/plaque vibration.png"
      },
      {
        produit: "Bâche protection",
        becarefull: "",
        qte: 1,
        prixHT: 8.80,
        prixTTC: 10.56,
        commentaire: "Humidité sol / saleté",
        lien: "https://www.amazon.fr/Imperm%C3%A9able-Industrielle-Multifonction/dp/B0CHJW6T4Y",
        image: "image/bache.png"
      },
      {
        produit: "Diable rigide STANDERS",
        becarefull: "",
        qte: 1,
        prixHT: 43.12,
        prixTTC: 51.74,
        commentaire: "",
        lien: "https://www.leroymerlin.fr/produits/diable-rigide-standers-charge-garantie-200-kg-85106882.html",
        image: "image/diable.png"
      }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // ONGLET 2 — Frais pour une location château
  // ─────────────────────────────────────────────────────────────
  fraisRecurrent: {
    title: "Frais de service",
    subtitle: "Coûts variables par journée de location",
    accentClass: "accent-green",
    columns: [
      { key: "intitule",    label: "Intitulé",    type: "text"   },
      { key: "commentaire", label: "Commentaire", type: "text"   },
      { key: "usure",       label: "Usure / loc", type: "number" },
      { key: "prixHT",      label: "Prix HT",     type: "price"  },
      { key: "prixTTC",     label: "Prix TTC",    type: "price"  },
      { key: "coutParLoc",  label: "Coût / loc",  type: "price", compute: row => (row.prixHT || 0) * (parseFloat(row.usure) || 0) }
    ],
    rows: [
      {
        intitule: "Essence SP98",
        commentaire: "~12 L par jour de location",
        usure: 12,
        prixHT: 2.00,
        prixTTC: 2.00,
        coutParLoc: 24.00
      },
      {
        intitule: "Lingette micro fibre",
        commentaire: "Pack de 20 pour nettoyage",
        usure: 0.1,
        prixHT: 9.52,
        prixTTC: 11.42,
        coutParLoc: 1.14
      },
      {
        intitule: "Dégraissant produit",
        commentaire: "",
        usure: 0.1,
        prixHT: 41.52,
        prixTTC: 51.90,
        coutParLoc: 5.19
      },
      {
        intitule: "Huile 4T",
        commentaire: "",
        usure: 0.1,
        prixHT: 17.60,
        prixTTC: 21.12,
        coutParLoc: 2.11
      }
    ],
    totalCoutParLoc: 32.44
  },

  // ─────────────────────────────────────────────────────────────
  // ONGLET 3 — Frais Initiaux (création de la société)
  // ─────────────────────────────────────────────────────────────
  fraisInitiaux: {
    title: "Frais Initiaux",
    subtitle: "Frais de création et de démarrage",
    accentClass: "accent-orange",
    columns: [
      { key: "intitule",  label: "Intitulé",     type: "text"  },
      { key: "prixTTC",   label: "Montant TTC",  type: "price" },
      { key: "remarque",  label: "Remarque",     type: "text"  }
    ],
    rows: [
      {
        intitule: "Création SARL — Annonce légale",
        prixTTC: 200.00,
        remarque: ""
      },
      {
        intitule: "Création SARL — Greffe / immatriculation",
        prixTTC: 270.00,
        remarque: ""
      },
      {
        intitule: "Expert comptable — Accompagnement création",
        prixTTC: 500.00,
        remarque: ""
      }
    ],
    totalPrixTTC: 970.00
  },

  // ─────────────────────────────────────────────────────────────
  // ONGLET 4 — Frais de maintenance (annuels)
  // ─────────────────────────────────────────────────────────────
  fraisMaintenance: {
    title: "Frais de maintenance",
    subtitle: "Coûts annuels de maintenance",
    accentClass: "accent-orange",
    columns: [
      { key: "intitule", label: "Intitulé",           type: "text"  },
      { key: "prixTTC",  label: "Montant TTC / an",   type: "price" },
      { key: "remarque", label: "Remarque",            type: "text"  }
    ],
    rows: [
      { intitule: "Contrôle technique", prixTTC: 300.00, remarque: "" }
    ],
    totalPrixTTC: 300.00
  },

  // ─────────────────────────────────────────────────────────────
  // ONGLET 5 — Frais récurrents (annuels)
  // ─────────────────────────────────────────────────────────────
  fraisRecurrentsAnnuels: {
    title: "Frais récurrents",
    subtitle: "Charges fixes annuelles",
    accentClass: "accent-red",
    columns: [
      { key: "intitule", label: "Intitulé",          type: "text"  },
      { key: "prixTTC",  label: "Montant TTC / an",  type: "price" },
      { key: "remarque", label: "Remarque",           type: "text"  }
    ],
    rows: [
      {
        intitule: "RC Pro",
        prixTTC: 900.00,
        remarque: "Responsabilité Civile Professionnelle"
      },
      {
        intitule: "Assurance multirisque matériel professionnel",
        prixTTC: null,
        computed: "assurance_materiel",
        remarque: "6 % du coût du matériel (photobooths + châteaux achat + électrogène)"
      },
      {
        intitule: "Comptable",
        prixTTC: 1200.00,
        remarque: ""
      },
      {
        intitule: "Compte bancaire pro",
        prixTTC: 120.00,
        remarque: "10 € / mois"
      },
      {
        intitule: "Hébergement",
        prixTTC: 70.00,
        remarque: ""
      },
      {
        intitule: "Nom de domaine + mail",
        prixTTC: 17.00,
        remarque: ""
      }
    ]
    // Pas de totalPrixTTC statique — calculé dynamiquement
  },

  // ─────────────────────────────────────────────────────────────
  // ONGLET 6 — Photobooth — Investissement matériel
  // ─────────────────────────────────────────────────────────────
  photobooth: {
    title: "Photobooth",
    subtitle: "Équipement et accessoires — à compléter",
    accentClass: "accent-purple",
    columns: [
      { key: "produit",     label: "Produit",     type: "text"  },
      { key: "prixTTC",     label: "Prix TTC",    type: "price" },
      { key: "commentaire", label: "Commentaire", type: "text"  }
    ],
    rows: []
  },

  // Photobooth — Frais de service par journée (à compléter)
  fraisServicePhotobooth: {
    title: "Frais de service — Photobooth",
    subtitle: "Coûts variables par journée de location",
    accentClass: "accent-purple",
    columns: [
      { key: "intitule",   label: "Intitulé",    type: "text"  },
      { key: "prixTTC",    label: "Prix TTC",    type: "price" },
      { key: "coutParLoc", label: "Coût / loc",  type: "price" }
    ],
    rows: []
  },

  // Photobooth — Frais de maintenance annuels (à compléter)
  fraisMaintenancePhotobooth: {
    title: "Frais de maintenance — Photobooth",
    subtitle: "Coûts annuels de maintenance",
    accentClass: "accent-purple",
    columns: [
      { key: "intitule", label: "Intitulé",         type: "text"  },
      { key: "prixTTC",  label: "Montant TTC / an", type: "price" },
      { key: "remarque", label: "Remarque",          type: "text"  }
    ],
    rows: []
  }
};
