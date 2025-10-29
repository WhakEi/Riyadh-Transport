package com.riyadhtransport.fragments;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import com.google.android.material.textfield.TextInputEditText;
import com.riyadhtransport.R;

public class LinesFragment extends Fragment {
    
    private TextInputEditText searchInput;
    private RecyclerView linesRecycler;
    
    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_lines, container, false);
    }
    
    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);
        
        // Initialize views
        searchInput = view.findViewById(R.id.search_lines);
        linesRecycler = view.findViewById(R.id.lines_recycler);
        
        // Setup RecyclerView
        linesRecycler.setLayoutManager(new LinearLayoutManager(requireContext()));
        
        // TODO: Load and display metro and bus lines
        Toast.makeText(requireContext(), "Lines view - to be implemented", 
                Toast.LENGTH_SHORT).show();
    }
}
