export default {
  presets: [
    ['@babel/preset-env', { 
      targets: 'defaults',
      modules: false 
    }],
    ['@babel/preset-react', { 
      runtime: 'automatic' 
    }],
    '@babel/preset-typescript',
  ],
  env: {
    development: {
      presets: [
        ['@babel/preset-env', { 
          targets: 'defaults',
          modules: 'auto' 
        }],
        ['@babel/preset-react', { 
          runtime: 'automatic',
          development: true 
        }],
        '@babel/preset-typescript',
      ],
    },
  },
};