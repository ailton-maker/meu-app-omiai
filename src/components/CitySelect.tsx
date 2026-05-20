import React, { useEffect, useState } from 'react';
import CreatableSelect from 'react-select/creatable';

interface City {
  id: number;
  nome: string;
  microrregiao: {
    mesorregiao: {
      UF: {
        sigla: string;
      };
    };
  };
}

interface CitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const CitySelect: React.FC<CitySelectProps> = ({ value, onChange, placeholder = "Selecione sua cidade..." }) => {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCities = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
        const data: City[] = await response.json();
        const formatted = data.map(city => ({
          label: `${city.nome}, ${city.microrregiao.mesorregiao.UF.sigla}`,
          value: `${city.nome}, ${city.microrregiao.mesorregiao.UF.sigla}`
        }));
        setOptions(formatted);
      } catch (error) {
        console.error('Error fetching cities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCities();
  }, []);

  const customStyles = {
    control: (base: any) => ({
      ...base,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '2px',
      color: 'white',
      '&:hover': {
        borderColor: 'rgba(255, 107, 0, 0.5)',
      }
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: '#1a1a1a',
      borderRadius: '16px',
      overflow: 'hidden',
      zIndex: 50
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isFocused ? 'rgba(255, 107, 0, 0.2)' : 'transparent',
      color: 'white',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#ff6b00',
      }
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'white',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }),
    input: (base: any) => ({
      ...base,
      color: 'white',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'rgba(255, 255, 255, 0.3)',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }),
    noOptionsMessage: (base: any) => ({
      ...base,
      color: 'rgba(255, 255, 255, 0.3)',
      fontSize: '10px',
      textTransform: 'uppercase',
    })
  };

  return (
    <CreatableSelect
      options={options}
      isLoading={isLoading}
      value={options.find(opt => opt.value === value) || (value ? { label: value, value } : null)}
      onChange={(opt) => opt && onChange(opt.value)}
      styles={customStyles}
      placeholder={isLoading ? "Carregando cidades..." : placeholder}
      noOptionsMessage={() => "Nenhuma cidade encontrada"}
      loadingMessage={() => "Buscando cidades..."}
      formatCreateLabel={(inputValue) => `Usar "${inputValue}"`}
      isSearchable
    />
  );
};
