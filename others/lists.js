module.exports = [
	{ 	
		name:'AREDL',
		fullname: "All Rated Extreme Demons List",
	  	value:'aredl',
	  	repo:'https://github.com/All-Rated-Extreme-Demon-List/AREDL.git',
		cutoff: null,
	  	score: (pos, level_count) => {
			const baseFactor = 0.0005832492374192035997815;
			const b = (level_count - 1) * baseFactor;
			const a = 600 * Math.sqrt(b);
			return (a / Math.sqrt(pos / 50 + b) - 100);
		},
	},
	{ 
		name:'HDL',
		fullname: "Hard Demon List",
		value:'hdl',
		repo:'https://github.com/Robaleg9/HardDemonList.git',
		cutoff: 150,
		score: (pos, level_count) => {
			return ((-0.22371358 * (pos + 1)) + 50.22371358);
		}
	}
]
